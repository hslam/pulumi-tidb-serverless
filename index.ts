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
const numberOfAvailabilityZones = config.getNumber("cluster-availability-zones") || 3;
const controlPlaneEnabled = config.getObject("control-plane-enabled") || false;
const serverlessEnabled = config.getObject("serverless-enabled") || false;

// Allocate a new VPC with custom settings, and a public & private subnet per AZ.
const vpc = new awsx.ec2.Vpc(`${prefix}-vpc`, {
    numberOfAvailabilityZones: numberOfAvailabilityZones,
    cidrBlock: cidrBlock,
    subnets: [{type: "public"}, {type: "private"}],
});

// Export VPC ID and Subnets.
export const vpcId = vpc.id;
export const allVpcSubnets = pulumi.all([vpc.privateSubnetIds, vpc.publicSubnetIds])
    .apply(([privateSubnetIds, publicSubnetIds]) => privateSubnetIds.concat(publicSubnetIds).sort((a, b) => (a > b ? -1 : 1)));
export const privateSubnetIds = pulumi.all([vpc.privateSubnetIds])
    .apply(([privateSubnetIds]) => privateSubnetIds.sort((a, b) => (a > b ? -1 : 1)));

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


const nodeGroups: eks.ManagedNodeGroup[] = [];
for (const options of asg.loadNodeGroupOptionsList()) {
    if (options.multipleASGs) {
        privateSubnetIds.apply((privateSubnetIds) => {
            const azMinSizeList = asg.availabilityZoneSizeList(options.min, numberOfAvailabilityZones)
            const azMaxSizeList = asg.availabilityZoneSizeList(options.max, numberOfAvailabilityZones)
            for (let i = 0; i < privateSubnetIds.length; i++) {
                const minSize = azMinSizeList[i]
                if (minSize <= 0) {
                    continue
                }
                options.min = minSize
                options.max = azMaxSizeList[i]
                const subnetId = privateSubnetIds[i]
                aws.ec2.getSubnet({id: subnetId}).then((subnet) => {
                    const availabilityZone = subnet.availabilityZone;
                    let subnetIds: pulumi.Input<string>[] = [subnetId];
                    // Create a managed node group in a specific AZ.
                    const nodeGroup = asg.createManagedNodeGroup(`${prefix}-${availabilityZone}-${asg.nodeGroupName(options)}`, {
                        options: options,
                        env: env,
                        prefix: prefix,
                        role: managedASGRole,
                        subnetIds: subnetIds,
                        cluster: cluster,
                    });
                    nodeGroups.push(nodeGroup);
                });

            }
        });
    } else {
        // Create a managed node group across multiple AZs.
        const nodeGroup = asg.createManagedNodeGroup(`${prefix}-${asg.nodeGroupName(options)}`, {
            options: options,
            env: env,
            prefix: prefix,
            role: managedASGRole,
            subnetIds: privateSubnetIds,
            cluster: cluster,
        });
        nodeGroups.push(nodeGroup);
    }
}

const dependencies: pulumi.Input<pulumi.Resource>[] = [...nodeGroups];
if (controlPlaneEnabled) {
    const clusterAutoScaler = autoscaler.InstallAutoScaler(cluster, env, ...nodeGroups);
    dependencies.push(clusterAutoScaler);
    const scDriver = csi.InstallCSIDriver(cluster, env, prefix, ...nodeGroups);
    dependencies.push(scDriver);
    const sc = csi.InstallEBSSC(cluster, scDriver);
    dependencies.push(sc);
    const tidbOperator = serverless.InstallTiDBOperator(cluster.provider, ...nodeGroups);
    dependencies.push(tidbOperator);
}

if (controlPlaneEnabled && serverlessEnabled) {
    serverless.InstallServerless(cluster.provider, prefix, ...dependencies)
}
