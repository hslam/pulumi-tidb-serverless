// Copyright (c) 2023 Meng Huang (mhboy@outlook.com)
// This package is licensed under a MIT license that can be found in the LICENSE file.

import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

export interface NodeGroupOptions {
    component: string;
    tier: string;
    version: number;
    category: string;
    instanceTypes: string [];
    capacityType: string;
    min: number;
    desired: number;
    max: number;
    maxUnavailable: number;
    exclusive: boolean;
    numberASGs: number;
    startAZ: number;
    allowEmptyGroup: boolean;
}

const defaultNodeGroupOptions: NodeGroupOptions = {
    component: "default",
    tier: "standard",
    version: 0,
    category: "control-plane",
    instanceTypes: ["t2.medium"],
    capacityType: "ON_DEMAND",
    min: 0,
    desired: 0,
    max: 100,
    maxUnavailable: 1,
    exclusive: true,
    numberASGs: 0,
    startAZ: 0,
    allowEmptyGroup: false,
};

export function nodeGroupName(options: NodeGroupOptions): string {
    return `${options.component}-${options.tier}-${options.version}`;
}

export function loadNodeGroupOptionsList(): NodeGroupOptions[] {
    const optionsList = config.requireObject<NodeGroupOptions[]>(`nodegroups`);
    const list: NodeGroupOptions[] = [];
    for (const options of optionsList) {
        const overrideOptions: NodeGroupOptions = {
            ...defaultNodeGroupOptions,
            ...options,
        };
        list.push(overrideOptions);
    }
    return list;
}

export function availabilityZoneSizeList(size: number, numberOfAvailabilityZones: number): number[] {
    var azSizeList: number[] = new Array(numberOfAvailabilityZones)
    for (let i = 0; i < azSizeList.length; i++) {
        azSizeList[i] = Math.floor(size / numberOfAvailabilityZones)
    }
    if (size % numberOfAvailabilityZones > 0) {
        for (let i = 0; i < size % numberOfAvailabilityZones; i++) {
            azSizeList[i] += 1
        }
    }
    return azSizeList;
}

// Creates an EKS ManagedNodeGroup.
interface ManagedNodeGroupArgs {
    options: NodeGroupOptions;
    env: string;
    prefix: string;
    role: aws.iam.Role;
    subnetIds: pulumi.Input<pulumi.Input<string>[]>;
    cluster: eks.Cluster;
}

export function createManagedNodeGroup(
    name: string,
    args: ManagedNodeGroupArgs,
): eks.ManagedNodeGroup {
    let managedNodeGroupOptions: eks.ManagedNodeGroupOptions = {
        cluster: args.cluster,
        subnetIds: args.subnetIds,
        nodeRole: args.role,
        capacityType: args.options.capacityType,
        scalingConfig: {
            maxSize: args.options.max,
            desiredSize: args.options.desired,
            minSize: args.options.min,
        },
        instanceTypes: args.options.instanceTypes,
        updateConfig: {
            maxUnavailable: args.options.maxUnavailable,
        },
        tags: {
            "tidbcloud.com/env": `${args.env}`,
            servicetype: "serverless",
            environment: `${args.env}`,
            usedby: `${args.prefix}`,
            component: `${args.options.category}/${args.options.component}`,
        },
        labels: {
            ["serverless"]: args.options.component,
            ["tier"]: args.options.tier,
        },
    };
    if (args.options.exclusive) {
        managedNodeGroupOptions.taints = [
            {
                key: "serverless",
                value: args.options.component,
                effect: "NO_SCHEDULE",
            },
        ];
    }
    return new eks.ManagedNodeGroup(name, managedNodeGroupOptions, {
        providers: {kubernetes: args.cluster.provider},
    });
}
