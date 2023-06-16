// Copyright (c) 2023 Meng Huang (mhboy@outlook.com)
// This package is licensed under a MIT license that can be found in the LICENSE file.

import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";

// Create a VPC for our cluster.
const vpc = new awsx.ec2.Vpc("vpc", { numberOfAvailabilityZones: 3 });

// Create an EKS cluster with some configurations.
const cluster = new eks.Cluster("cluster", {
    vpcId: vpc.id,
    subnetIds: vpc.publicSubnetIds,
    instanceType: "t2.medium",
    desiredCapacity: 2,
    minSize: 1,
    maxSize: 2,
    storageClasses: "gp2",
    deployDashboard: false,
    version: "1.24",
});

// Export the cluster's kubeconfig.
export const kubeconfig = cluster.kubeconfig;
