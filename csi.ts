// Copyright (c) 2023 Meng Huang (mhboy@outlook.com)
// This package is licensed under a MIT license that can be found in the LICENSE file.

import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export function InstallCSIDriver(c: eks.Cluster, env: string, cluster: string, ...dependencies: pulumi.Input<pulumi.Resource>[]) {
    const ebsCSIControllerSaName = "ebs-csi-controller-sa";

    const oidc = c.core.oidcProvider!;
    const assumeRolePolicyDoc = pulumi.all([oidc.url, oidc.arn]).apply(([url, arn]) =>
        aws.iam.getPolicyDocument({
            statements: [
                {
                    actions: ["sts:AssumeRoleWithWebIdentity"],
                    conditions: [
                        {
                            test: "StringEquals",
                            values: [`system:serviceaccount:kube-system:${ebsCSIControllerSaName}`],
                            variable: `${url.replace("https://", "")}:sub`,
                        },
                    ],
                    effect: "Allow",
                    principals: [
                        {
                            identifiers: [arn],
                            type: "Federated",
                        },
                    ],
                },
            ],
        })
    );

    const csiRole = new aws.iam.Role(`${ebsCSIControllerSaName}-${env}`, {
        assumeRolePolicy: assumeRolePolicyDoc.json,
    });

    new aws.iam.RolePolicy(`${ebsCSIControllerSaName}-${env}`, {
        namePrefix: `${ebsCSIControllerSaName}-${env}`,
        role: csiRole,
        policy: {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: [
                        "ec2:CreateSnapshot",
                        "ec2:AttachVolume",
                        "ec2:DetachVolume",
                        "ec2:ModifyVolume",
                        "ec2:DescribeAvailabilityZones",
                        "ec2:DescribeInstances",
                        "ec2:DescribeSnapshots",
                        "ec2:DescribeTags",
                        "ec2:DescribeVolumes",
                        "ec2:DescribeVolumesModifications",
                    ],
                    Resource: "*",
                },
                {
                    Effect: "Allow",
                    Action: ["ec2:CreateTags"],
                    Resource: ["arn:aws:ec2:*:*:volume/*", "arn:aws:ec2:*:*:snapshot/*"],
                    Condition: {
                        StringEquals: {
                            "ec2:CreateAction": ["CreateVolume", "CreateSnapshot"],
                        },
                    },
                },
                {
                    Effect: "Allow",
                    Action: ["ec2:DeleteTags"],
                    Resource: ["arn:aws:ec2:*:*:volume/*", "arn:aws:ec2:*:*:snapshot/*"],
                },
                {
                    Effect: "Allow",
                    Action: ["ec2:CreateVolume"],
                    Resource: "*",
                    Condition: {
                        StringLike: {
                            "aws:RequestTag/ebs.csi.aws.com/cluster": "true",
                        },
                    },
                },
                {
                    Effect: "Allow",
                    Action: ["ec2:CreateVolume"],
                    Resource: "*",
                    Condition: {
                        StringLike: {
                            "aws:RequestTag/CSIVolumeName": "*",
                        },
                    },
                },
                {
                    Effect: "Allow",
                    Action: ["ec2:DeleteVolume"],
                    Resource: "*",
                    Condition: {
                        StringLike: {
                            "ec2:RequestTag/CSIVolumeName": "*",
                        },
                    },
                },
                {
                    Effect: "Allow",
                    Action: ["ec2:DeleteVolume"],
                    Resource: "*",
                    Condition: {
                        StringLike: {
                            "ec2:ResourceTag/ebs.csi.aws.com/cluster": "true",
                        },
                    },
                },
                {
                    Effect: "Allow",
                    Action: ["ec2:DeleteSnapshot"],
                    Resource: "*",
                    Condition: {
                        StringLike: {
                            "ec2:ResourceTag/CSIVolumeSnapshotName": "*",
                        },
                    },
                },
                {
                    Effect: "Allow",
                    Action: ["ec2:DeleteSnapshot"],
                    Resource: "*",
                    Condition: {
                        StringLike: {
                            "ec2:ResourceTag/ebs.csi.aws.com/cluster": "true",
                        },
                    },
                },
            ],
        },
    });

    const ebsCSIControllerSa = new k8s.core.v1.ServiceAccount(
        ebsCSIControllerSaName,
        {
            metadata: {
                namespace: "kube-system",
                name: ebsCSIControllerSaName,
                annotations: {
                    "eks.amazonaws.com/role-arn": csiRole.arn,
                },
            },
        },
        {provider: c.provider}
    );

    return new k8s.helm.v3.Chart(
        "aws-ebs-csi-driver",
        {
            chart: "aws-ebs-csi-driver",
            fetchOpts: {
                repo: "https://kubernetes-sigs.github.io/aws-ebs-csi-driver",
                version: "2.19.0",
            },
            namespace: "kube-system",
            values: {
                node: {
                    tolerateAllTaints: true,
                },
                controller: {
                    serviceAccount: {
                        create: false,
                        name: ebsCSIControllerSaName,
                    },
                    extraVolumeTags: {
                        servicetype: "serverless",
                        usedby: `${cluster}`,
                        environment: `${env}`,
                    },
                    affinity: {
                        podAntiAffinity: {
                            preferredDuringSchedulingIgnoredDuringExecution: [
                                {
                                    podAffinityTerm: {
                                        labelSelector: {
                                            matchExpressions: [
                                                {
                                                    key: "app",
                                                    operator: "In",
                                                    values: ["ebs-csi-controller"],
                                                },
                                            ],
                                        },
                                        topologyKey: "topology.kubernetes.io/zone",
                                    },
                                    weight: 100,
                                },
                            ],
                        },
                    },
                },
            },
        },
        {provider: c.provider, dependsOn: [ebsCSIControllerSa, ...dependencies]}
    );
}

export function InstallEBSSC(c: eks.Cluster, driver: k8s.helm.v3.Chart) {
    return new k8s.storage.v1.StorageClass(
        "ebs-sc",
        {
            metadata: {
                name: "ebs-sc",
            },
            provisioner: "ebs.csi.aws.com",
            volumeBindingMode: "WaitForFirstConsumer",
            allowVolumeExpansion: true,
            mountOptions: ["nodelalloc", "noatime"],
            parameters: {
                type: "gp3",
                fsType: "ext4",
                iops: "4000",
                throughput: "400",
            },
        },
        {deleteBeforeReplace: true, provider: c.provider, dependsOn: driver.ready}
    );
}
