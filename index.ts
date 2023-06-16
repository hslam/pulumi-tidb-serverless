// Copyright (c) 2023 Meng Huang (mhboy@outlook.com)
// This package is licensed under a MIT license that can be found in the LICENSE file.

import * as pulumi from "@pulumi/pulumi";
import * as eks from "@pulumi/eks";

// Create an EKS cluster with the default configuration.
const cluster = new eks.Cluster("cluster", {});

// Export the cluster's kubeconfig.
export const kubeconfig = cluster.kubeconfig;
