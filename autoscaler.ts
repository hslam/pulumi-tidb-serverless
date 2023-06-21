// Copyright (c) 2023 Meng Huang (mhboy@outlook.com)
// This package is licensed under a MIT license that can be found in the LICENSE file.

import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const downThreshold = config.get("cluster-autoscaler-down-threshold") || 0.5;
const caVersion = config.require("cluster-autoscaler-ca-version");

export function InstallAutoScaler(c: eks.Cluster, env: string, ...dependencies: pulumi.Input<pulumi.Resource>[]) {
    const clusterAutoScalerSaName = "cluster-autoscaler";

    const oidc = c.core.oidcProvider!;
    const assumeRolePolicyDoc = pulumi.all([oidc.url, oidc.arn]).apply(([url, arn]) =>
        aws.iam.getPolicyDocument({
            statements: [
                {
                    actions: ["sts:AssumeRoleWithWebIdentity"],
                    conditions: [
                        {
                            test: "StringEquals",
                            values: [`system:serviceaccount:kube-system:${clusterAutoScalerSaName}`],
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

    const clusterAutoScalerRole = new aws.iam.Role(`${clusterAutoScalerSaName}-${env}`, {
        assumeRolePolicy: assumeRolePolicyDoc.json,
    });

    new aws.iam.RolePolicy(`${clusterAutoScalerSaName}-${env}`, {
        namePrefix: `${clusterAutoScalerSaName}-${env}`,
        role: clusterAutoScalerRole,
        policy: {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: [
                        "autoscaling:DescribeAutoScalingGroups",
                        "autoscaling:DescribeAutoScalingInstances",
                        "autoscaling:DescribeLaunchConfigurations",
                        "autoscaling:DescribeTags",
                        "autoscaling:SetDesiredCapacity",
                        "autoscaling:TerminateInstanceInAutoScalingGroup",
                        "ec2:DescribeLaunchTemplateVersions",
                        "eks:DescribeNodegroup",
                        "ec2:DescribeInstanceTypes",
                    ],
                    Resource: "*",
                },
            ],
        },
    });

    const clusterAutoScalerSa = new k8s.core.v1.ServiceAccount(
        clusterAutoScalerSaName,
        {
            metadata: {
                namespace: "kube-system",
                name: clusterAutoScalerSaName,
                annotations: {
                    "eks.amazonaws.com/role-arn": clusterAutoScalerRole.arn,
                },
            },
        },
        {provider: c.provider}
    );

    const caImage = caVersion >= "v1.23" ?
        "registry.k8s.io/autoscaling/cluster-autoscaler" :
        "k8s.gcr.io/autoscaling/cluster-autoscaler";

    const chart = new k8s.helm.v3.Chart(
        "aws-cluster-auto-scaler",
        {
            namespace: "kube-system",
            values: {
                clusterName: pulumi.interpolate`${c.eksCluster.name}`,
                downThreshold: downThreshold,
                caVersion: caVersion,
                caImage: caImage,
            },
            path: "manifests/aws-cluster-auto-scaler",
        },
        {provider: c.provider, dependsOn: [clusterAutoScalerSa, ...dependencies]}
    );
    return chart;
}
