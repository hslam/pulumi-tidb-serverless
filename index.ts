// Copyright (c) 2023 Meng Huang (mhboy@outlook.com)
// This package is licensed under a MIT license that can be found in the LICENSE file.

import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as iam from "./iam";
import * as asg from "./asg";
import * as csi from "./csi";
import * as autoscaler from "./autoscaler";
import * as serverless from "./serverless";

const config = new pulumi.Config();

export const env = config.require("cluster-env");
export const region = config.require("cluster-region");
export const suffix = config.require("cluster-suffix");
export const prefix = `${env}-${region}-${suffix}`;
export const cidrBlock = config.require("cluster-cidr-block");
const k8sVersion = config.require("cluster-k8s-version");

// Allocate a new VPC with custom settings, and a public & private subnet per AZ.
const vpc = new awsx.ec2.Vpc(`${prefix}-vpc`, {
    cidrBlock: cidrBlock,
    subnets: [{type: "public"}, {type: "private"}],
});

// Export VPC ID and Subnets.
export const vpcId = vpc.id;
export const allVpcSubnets = pulumi.all([vpc.privateSubnetIds, vpc.publicSubnetIds])
    .apply(([privateSubnetIds, publicSubnetIds]) => privateSubnetIds.concat(publicSubnetIds));

// Create a IAM Roles and matching InstanceProfile to use with the nodegroups.
const managedASGRole = iam.createRole(`${prefix}-managed-nodegroup-role`);
const instanceProfile = new aws.iam.InstanceProfile(`${prefix}-instance-profile`, {role: managedASGRole});

// Create an EKS cluster without node group attached
const cluster = new eks.Cluster(`${prefix}-cluster`, {
    version: k8sVersion,
    name: prefix,
    vpcId: vpcId,
    subnetIds: allVpcSubnets,
    nodeAssociatePublicIpAddress: false,
    deployDashboard: false,
    createOidcProvider: true,
    useDefaultVpcCni: true,
    endpointPrivateAccess: true,
    endpointPublicAccess: true,
    skipDefaultNodeGroup: true,
    instanceRoles: [managedASGRole],
});

// Export the cluster's kubeconfig.
export const kubeconfig = cluster.kubeconfig;

const dependencies: pulumi.Input<pulumi.Resource>[] = [];

for (const options of asg.loadNodeGroupOptionsList()) {
    // Create a managed node group with the options.
    const nodeGroup = asg.createManagedNodeGroup(`${prefix}-${asg.nodeGroupName(options)}`, {
        options: options,
        env: env,
        role: managedASGRole,
        cluster: cluster,
        prefix: prefix,
        maxUnavailable: 1,
    });
    dependencies.push(nodeGroup);
}

if (config.getObject("cluster-autoscaler-enabled") || false) {
    autoscaler.InstallAutoScaler(cluster, env, ...dependencies);
}

const csiDriverEnabled = config.getObject("csi-driver-enabled") || false;
if (csiDriverEnabled) {
    const scDriver = csi.InstallCSIDriver(cluster, env, prefix, ...dependencies);
    dependencies.push(scDriver);
    const sc = csi.InstallEBSSC(cluster, scDriver);
    dependencies.push(sc);
}

if (config.getObject("tidb-operator-enabled") || false) {
    const tidbOperator = serverless.InstallTiDBOperator(cluster.provider, ...dependencies);
    dependencies.push(tidbOperator);
    if (csiDriverEnabled && config.getObject("serverless-enabled") || false) {
        serverless.InstallServerless(cluster.provider, prefix, ...dependencies)
    }
}
