// Copyright (c) 2023 Meng Huang (mhboy@outlook.com)
// This package is licensed under a MIT license that can be found in the LICENSE file.

import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as iam from "./iam";

const config = new pulumi.Config();

export const env = config.require("env");
export const region = config.require("region");
export const prefix = `${env}-${region}-tidb`;
export const cidrBlock = config.require("cidr-block");
const numberOfAvailabilityZones = config.getNumber("availability-zones") || 3;
const k8sVersion = config.require("k8s-version");

// Allocate a new VPC with custom settings, and a public & private subnet per AZ.
const vpc = new awsx.ec2.Vpc(`${prefix}-vpc`, {
    numberOfAvailabilityZones: numberOfAvailabilityZones,
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

// Create an AWS node group using a cluster as input.
const nodeGroup = cluster.createNodeGroup("${prefix}-node-group", {
    instanceType: "t2.medium",
    maxSize: 2,
    desiredCapacity: 2,
    minSize: 1,
    labels: {"ondemand": "true"},
    instanceProfile: instanceProfile,
});

// Create an AWS managed node group using a cluster as input.
const managedNodeGroup = eks.createManagedNodeGroup("${prefix}-managed-node-group", {
    cluster: cluster,
    subnetIds: allVpcSubnets,
    capacityType: "ON_DEMAND",
    instanceTypes: ["t2.medium"],
    scalingConfig: {
        maxSize: 2,
        desiredSize: 2,
        minSize: 1,
    },
    nodeRoleArn: managedASGRole.arn,
    labels: {"ondemand": "true"},
    tags: {"org": "pulumi"},
}, cluster);

// Export the cluster's kubeconfig.
export const kubeconfig = cluster.kubeconfig;
