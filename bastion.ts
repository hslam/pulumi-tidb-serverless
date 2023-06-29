// Copyright (c) 2023 Meng Huang (mhboy@outlook.com)
// This package is licensed under a MIT license that can be found in the LICENSE file.

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

export function createBastion(prefix: string, env: string, vpcId: string, subnetId: string): aws.ec2.Instance {
    const sshSg = new aws.ec2.SecurityGroup(`${prefix}-bastion-security-group`, {
        vpcId: vpcId,
        ingress: [{protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"]}],
        egress: [{protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"]}],
        tags: {
            servicetype: "serverless",
            environment: `${env}`,
            usedby: `${prefix}`,
            component: "control-plane/security-group",
        },
    });

    const amiId = config.require("bastion-ami-id");
    const instanceType = config.require("bastion-instance-type");
    const publicKey = config.require("bastion-public-key");

    const sshKey = new aws.ec2.KeyPair(`${prefix}-bastion-key-pair`, {publicKey: publicKey});

    const bastion = new aws.ec2.Instance(`${prefix}-bastion`, {
        instanceType: instanceType,
        ami: amiId,
        subnetId: subnetId,
        vpcSecurityGroupIds: [sshSg.id],
        associatePublicIpAddress: true,
        keyName: sshKey.keyName,
        tags: {
            servicetype: "serverless",
            environment: `${env}`,
            usedby: `${prefix}`,
            component: "control-plane/bastion",
        },
    });

    return bastion;
}
