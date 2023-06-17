// Copyright (c) 2023 Meng Huang (mhboy@outlook.com)
// This package is licensed under a MIT license that can be found in the LICENSE file.

import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const amiId = config.require("ami-id");

export interface NodeGroupOptions {
    component: string;
    tier: string;
    version: number;
    category: string;
    ami: string;
    instanceTypes: string [];
    capacityType: string;
    min: number;
    max: number;
    exclusive: boolean;
}

const defaultNodeGroupOptions: NodeGroupOptions = {
    component: "default",
    tier: "standard",
    version: 0,
    category: "control-plane",
    ami: amiId,
    instanceTypes: ["t2.medium"],
    capacityType: "ON_DEMAND",
    min: 0,
    max: 100,
    exclusive: true,
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

// Creates an EKS ManagedNodeGroup.
interface ManagedNodeGroupArgs {
    options: NodeGroupOptions;
    env: string;
    role: aws.iam.Role;
    cluster: eks.Cluster;
    prefix: string;
    subnetIds: pulumi.Input<pulumi.Input<string>[]>;
    maxUnavailable: number;
}

export function createManagedNodeGroup(
    name: string,
    args: ManagedNodeGroupArgs,
): eks.ManagedNodeGroup {
    let managedNodeGroupOptions: eks.ManagedNodeGroupOptions = {
        cluster: args.cluster,
        subnetIds: args.subnetIds,
        capacityType: args.options.capacityType,
        scalingConfig: {
            maxSize: args.options.max,
            desiredSize: args.options.min,
            minSize: args.options.min,
        },
        instanceTypes: args.options.instanceTypes,
        nodeRole: args.role,
        updateConfig: {
            maxUnavailable: args.maxUnavailable,
        },
        tags: {
            "tidbcloud.com/env": `${args.env}`,
            servicetype: "serverless",
            environment: `${args.env}`,
            usedby: `${args.prefix}`,
            component: `${args.options.category}/${args.options.component}`,
        },
        labels: {
            ["serverless.tidbcloud.com/node"]: args.options.component,
        },
    };
    if (args.options.exclusive) {
        managedNodeGroupOptions.taints = [
            {
                key: "serverless.tidbcloud.com/node",
                value: args.options.component,
                effect: "NO_SCHEDULE",
            },
        ];
    }
    return new eks.ManagedNodeGroup(name, managedNodeGroupOptions, {
        providers: {kubernetes: args.cluster.provider},
    });
}
