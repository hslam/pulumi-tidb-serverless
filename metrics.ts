// Copyright (c) 2023 Meng Huang (mhboy@outlook.com)
// This package is licensed under a MIT license that can be found in the LICENSE file.

import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const metricsServerVersion = config.require("metrics-server-chart-version");

export function InstallMetricsServer(c: eks.Cluster, ...dependencies: pulumi.Input<pulumi.Resource>[]) {
    const chart = new k8s.helm.v3.Chart(
        "metrics-server",
        {
            chart: "metrics-server",
            fetchOpts: {
                repo: "https://kubernetes-sigs.github.io/metrics-server/",
                version: metricsServerVersion,
            },
            namespace: "kube-system",
        },
        {provider: c.provider, dependsOn: [...dependencies]}
    );
    return chart;
}
