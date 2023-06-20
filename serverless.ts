// Copyright (c) 2023 Meng Huang (mhboy@outlook.com)
// This package is licensed under a MIT license that can be found in the LICENSE file.

import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

const nsName = config.get<string>("serverless-namespace") || "tidb-serverless";
const tidbOperatorTag = config.get<string>("tidb-operator-tag") || "v1.4.4";
const keyspaces = config.getObject<Keyspace[]>(`serverless-keyspaces`) || [];
const pdReplicas = config.getNumber("serverless-pd-replicas") || 1;
const pdVersion = config.get<string>("serverless-pd-version") || "v7.1.0";
const pdStorageSize = config.get<string>("serverless-pd-storage-size") || "10Gi";
const tikvReplicas = config.getNumber("serverless-tikv-replicas") || 1;
const tikvVersion = config.get<string>("serverless-tikv-version") || "v7.1.0";
const tikvStorageSize = config.get<string>("serverless-tikv-storage-size") || "10Gi";
const tidbReplicas = config.getNumber("serverless-tidb-replicas") || 1;
const tidbVersion = config.get<string>("serverless-tidb-version") || "v7.1.0";

interface Keyspace {
    name: string;
    tidbReplicas: number;
    rootPassword: string;
    externalIP: boolean;
}

const defaultKeyspace: Keyspace = {
    name: "",
    tidbReplicas: 0,
    rootPassword: "",
    externalIP: false,
};

// Install TiDB Operator.
export function InstallTiDBOperator(provider: k8s.Provider, ...dependencies: pulumi.Input<pulumi.Resource>[]) {
    // Install TiDB Operator Custom Resource Definitions (CRDs) that implement different components of the TiDB cluster.
    const crds = new k8s.yaml.ConfigFile(
        "tidb-operator-crds",
        {
            file: `https://raw.githubusercontent.com/pingcap/tidb-operator/${tidbOperatorTag}/manifests/crd.yaml`,
        },
        {provider: provider, dependsOn: [...dependencies]},
    );

    // Install TiDB Operator using Helm v3.
    return new k8s.helm.v3.Release("tidb-operator", {
            chart: "tidb-operator",
            namespace: "kube-system",
            repositoryOpts: {
                repo: "https://charts.pingcap.org/",
            },
            version: `${tidbOperatorTag}`,
            values: {
                scheduler: {
                    kubeSchedulerImageName: "registry.k8s.io/kube-scheduler",
                }
            }
        },
        {provider: provider, dependsOn: [crds, ...dependencies]},
    );
}

// Install serverless cluster
export function InstallServerless(provider: k8s.Provider, prefix: string, ...dependencies: pulumi.Input<pulumi.Resource>[]) {
    // Create serverless namespace.
    const ns = new k8s.core.v1.Namespace(
        `${prefix}-serverless-ns`,
        {
            metadata: {
                name: nsName,
            },
        },
        {provider: provider, dependsOn: [...dependencies]},
    );

    // Create shared TiKV cluster.
    const sharedTC = CreateSharedTC(provider, prefix, nsName, "serverless-cluster", pdReplicas, tidbReplicas, tikvReplicas, keyspaces, ns, ...dependencies);
    for (const keyspace of keyspaces) {
        if (keyspace.name.length > 0 && keyspace.tidbReplicas > 0) {
            // Create tenant TiDB cluster.
            const tenantTCName = `serverless-cluster-${keyspace.name}`
            const tenantTC = CreateTenantTiDBTC(provider, prefix, nsName, tenantTCName, "serverless-cluster", nsName, keyspace, ns, sharedTC, ...dependencies);
            if (keyspace.rootPassword.length > 0) {
                const tenantSecretName = `serverless-secret-${keyspace.name}`
                const tenantSecret = new k8s.core.v1.Secret(
                    `${prefix}-serverless-secret-${keyspace.name}`,
                    {
                        metadata: {
                            name: tenantSecretName,
                            namespace: nsName,
                        },
                        data: {"root": btoa(keyspace.rootPassword)},
                    },
                    {provider: provider, dependsOn: [ns, sharedTC, tenantTC, ...dependencies]},
                );
                const tenantTiDBInitializerName = `serverless-initializer-${keyspace.name}`
                CreateTiDBInitializer(provider, prefix, nsName, tenantTiDBInitializerName, tenantTCName, nsName, tenantSecretName, ns, sharedTC, tenantTC, tenantSecret, ...dependencies);
            }
        }
    }
}


function CreateTiDBInitializer(
    provider: k8s.Provider,
    prefix: string,
    ns: string,
    name: string,
    externalName: string,
    externalNamespace: string,
    passwordSecret: string,
    ...dependencies: pulumi.Input<pulumi.Resource>[]
) {
    return new k8s.yaml.ConfigFile(
        prefix + "-" + name,
        {
            file: "manifests/serverless/tidb-initializer.yaml",
            transformations: [
                withNamespace(ns),
                withName(name),
                withExternalCluster(externalName, externalNamespace),
                withTiDBInitializerPasswordSecret(passwordSecret),
            ],
        },
        {
            provider: provider,
            dependsOn: [...dependencies],
        }
    );
}

function withTiDBInitializerPasswordSecret(passwordSecret: string) {
    return (obj: any, _opts: pulumi.CustomResourceOptions) => {
        assertGVK(obj, "pingcap.com/v1alpha1", "TidbInitializer");
        obj.spec.passwordSecret = passwordSecret;
    };
}


function CreateSharedTC(
    provider: k8s.Provider,
    prefix: string,
    ns: string,
    name: string,
    pdReplicas: number,
    tidbReplicas: number,
    tikvReplicas: number,
    keyspaces: Keyspace[],
    ...dependencies: pulumi.Input<pulumi.Resource>[]
) {
    return CreateTC(provider, prefix, nsName, name, "", "", pdReplicas, tidbReplicas, tikvReplicas, keyspaces, defaultKeyspace, ...dependencies);
}

function CreateTenantTiDBTC(
    provider: k8s.Provider,
    prefix: string,
    ns: string,
    name: string,
    externalName: string,
    externalNamespace: string,
    keyspace: Keyspace,
    ...dependencies: pulumi.Input<pulumi.Resource>[]
) {
    return CreateTC(provider, prefix, nsName, name, externalName, externalNamespace, 0, keyspace.tidbReplicas, 0, [], keyspace, ...dependencies);
}

function CreateTC(
    provider: k8s.Provider,
    prefix: string,
    ns: string,
    name: string,
    externalName: string,
    externalNamespace: string,
    pdReplicas: number,
    tidbReplicas: number,
    tikvReplicas: number,
    keyspaces: Keyspace[],
    keyspace: Keyspace,
    ...dependencies: pulumi.Input<pulumi.Resource>[]
) {
    const keyspaceNames: string[] = [];
    for (const keyspace of keyspaces) {
        if (keyspace.name.length > 0) {
            keyspaceNames.push(keyspace.name)
        }
    }
    let preAllocKeyspaces = `[]`
    if (keyspaceNames.length > 0) {
        preAllocKeyspaces = `["${keyspaceNames.join(`", "`)}"]`
    }
    return new k8s.yaml.ConfigFile(
        prefix + "-" + name,
        {
            file: "manifests/serverless/tidb-cluster.yaml",
            transformations: [
                withNamespace(ns),
                withName(name),
                withExternalCluster(externalName, externalNamespace),
                withTiDBClusterImage("pd", "pingcap/pd", pdVersion),
                withTiDBClusterImage("tikv", "pingcap/tikv", tikvVersion),
                withTiDBClusterImage("tidb", "pingcap/tidb", tidbVersion),
                withTiDBClusterStorageSize("pd", pdStorageSize),
                withTiDBClusterStorageSize("tikv", tikvStorageSize),
                withTiDBClusterReplicas("pd", pdReplicas),
                withTiDBClusterReplicas("tidb", tidbReplicas),
                withTiDBClusterReplicas("tikv", tikvReplicas),
                withTiDBClusterConfigItem("pd", "{{PreAllocKeyspaces}}", preAllocKeyspaces),
                withTiDBClusterKeyspace("tidb", keyspace),
            ],
        },
        {
            provider: provider,
            dependsOn: [...dependencies],
            customTimeouts: {
                create: "15m",
                delete: "15m",
                update: "15m",
            },
        }
    );
}

export function withNamespace(ns: string) {
    return (obj: any, _opts: pulumi.CustomResourceOptions) => {
        obj.metadata.namespace = ns;
    };
}

export function withName(name: string) {
    return (obj: any, _opts: pulumi.CustomResourceOptions) => {
        obj.metadata.name = name;
    };
}

export function withExternalCluster(name: string, ns: string) {
    return (obj: any, _opts: pulumi.CustomResourceOptions) => {
        if (name.length > 0) {
            obj.spec.cluster.name = name;
            if (ns.length > 0) {
                obj.spec.cluster.namespace = ns;
            }
        } else {
            obj.spec.cluster = null;
        }
    };
}

function withTiDBClusterImage(name: string, baseImage: string, imageVersion: string) {
    return (obj: any, _opts: pulumi.CustomResourceOptions) => {
        assertGVK(obj, "pingcap.com/v1alpha1", "TidbCluster");
        if (name === "pd") {
            obj.spec.pd.baseImage = baseImage;
            obj.spec.pd.version = imageVersion;
        } else if (name === "tikv") {
            obj.spec.tikv.baseImage = baseImage;
            obj.spec.tikv.version = imageVersion;
        } else if (name === "tidb") {
            obj.spec.tidb.baseImage = baseImage;
            obj.spec.tidb.version = imageVersion;
        }
    };
}

function withTiDBClusterStorageSize(name: string, storageSize: string) {
    return (obj: any, _opts: pulumi.CustomResourceOptions) => {
        assertGVK(obj, "pingcap.com/v1alpha1", "TidbCluster");
        if (name === "pd") {
            obj.spec.pd.requests.storage = storageSize;
        } else if (name === "tikv") {
            obj.spec.tikv.requests.storage = storageSize;
        }
    };
}

function withTiDBClusterReplicas(name: string, replicas: number) {
    return (obj: any, _opts: pulumi.CustomResourceOptions) => {
        assertGVK(obj, "pingcap.com/v1alpha1", "TidbCluster");
        if (name === "pd") {
            if (replicas > 0) {
                obj.spec.pd.replicas = replicas;
            } else {
                obj.spec.pd = null;
            }
        } else if (name === "tikv") {
            if (replicas > 0) {
                obj.spec.tikv.replicas = replicas;
            } else {
                obj.spec.tikv = null;
            }
        } else if (name === "tidb") {
            if (replicas > 0) {
                obj.spec.tidb.replicas = replicas;
            } else {
                obj.spec.tidb = null;
            }
        }
    };
}

function withTiDBClusterKeyspace(name: string, keyspace: Keyspace) {
    return (obj: any, _opts: pulumi.CustomResourceOptions) => {
        assertGVK(obj, "pingcap.com/v1alpha1", "TidbCluster");
        if (name === "tidb") {
            if (obj.spec.tidb != null) {
                if (keyspace.name.length > 0) {
                    obj.spec.tidb.config = (obj.spec.tidb.config as string).replace("{{KeyspaceName}}", `"${keyspace.name}"`);
                    if (keyspace.externalIP) {
                        obj.spec.tidb.service.type = "LoadBalancer";
                    }
                } else {
                    obj.spec.tidb.config = (obj.spec.tidb.config as string).replace("{{KeyspaceName}}", `""`);
                    obj.spec.tidb.nodeSelector = null;
                    obj.spec.tidb.tolerations = null;
                }
            }
        }
    };
}

function withTiDBClusterConfigItem(name: string, pattern: string, value: string) {
    return (obj: any, _opts: pulumi.CustomResourceOptions) => {
        assertGVK(obj, "pingcap.com/v1alpha1", "TidbCluster");
        if (name === "pd") {
            if (obj.spec.pd != null) {
                obj.spec.pd.config = (obj.spec.pd.config as string).replace(pattern, value);
            }
        } else if (name === "tikv" && obj.spec.tikv != null) {
            if (obj.spec.tikv != null) {
                obj.spec.tikv.config = (obj.spec.tikv.config as string).replace(pattern, value);
            }
        } else if (name === "tidb") {
            if (obj.spec.tidb != null) {
                obj.spec.tidb.config = (obj.spec.tidb.config as string).replace(pattern, value);
            }
        }
    };
}

export const assertGVK = (obj: any, gv: string, kind: string) => {
    if (!obj) {
        throw new Error(`obj is undefined`);
    }
    if (!isMatchGVK(obj, gv, kind)) {
        throw new Error(`invalid gvk, expected: ${gv}:${kind}, actual: ${obj.apiVersion}:${obj.kind}`);
    }
};

export const isMatchGVK = (obj: any, gv: string, kind: string) => {
    if (!obj) {
        return false;
    }
    return obj.apiVersion === gv && obj.kind === kind;
};
