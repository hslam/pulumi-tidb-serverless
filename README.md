# pulumi-shared-storage-tidb
Deploy a shared storage TiDB cluster on AWS using pulumi.

## Getting started

### Prerequisites

* [Install Pulumi](https://www.pulumi.com/docs/install/)
* [Install Node.js](https://nodejs.org/en/download)
* Install a package manager for Node.js, such as [npm](https://www.npmjs.com/get-npm) or [Yarn](https://classic.yarnpkg.com/en/docs/install).
* [Configure AWS credentials](https://www.pulumi.com/registry/packages/aws/installation-configuration/)
* [Install AWS IAM Authenticator for Kubernetes](https://docs.aws.amazon.com/eks/latest/userguide/install-aws-iam-authenticator.html)

### Initialize the Pulumi Project
1. Start by cloning the project to your local machine.
```
$ git clone https://github.com/hslam/pulumi-shared-storage-tidb.git
$ cd pulumi-shared-storage-tidb
```
2. Install the dependencies.
```
$ npm install
```
3. Create a new Pulumi stack named dev-us-east-1-f01.
```
$ pulumi stack init dev-us-east-1-f01
```

### Provisioning a New EKS Cluster
Create the EKS cluster by running `pulumi up`.
```
$ pulumi up
Updating (dev-us-east-1-f01)

     Type                                                              Name                                                         Status
 +   pulumi:pulumi:Stack                                               pulumi-shared-storage-tidb-dev-us-east-1-f01                 created (711s)
 +   ├─ awsx:x:ec2:Vpc                                                 dev-us-east-1-f01-vpc                                        created (5s)
 +   ├─ eks:index:Cluster                                              dev-us-east-1-f01-cluster                                    created (707s)
 +   ├─ aws:iam:Role                                                   dev-us-east-1-f01-managed-nodegroup-role                     created (3s)
 +   ├─ eks:index:ManagedNodeGroup                                     dev-us-east-1-f01-tikv-standard-0                            created (4s)
 +   ├─ eks:index:ManagedNodeGroup                                     dev-us-east-1-f01-default-standard-0                         created (7s)
 +   ├─ eks:index:ManagedNodeGroup                                     dev-us-east-1-f01-pd-standard-0                              created (9s)
 +   ├─ eks:index:ManagedNodeGroup                                     dev-us-east-1-f01-tidb-standard-0                            created (10s)
 +   ├─ kubernetes:core/v1:ServiceAccount                              ebs-csi-controller-sa                                        created (4s)
 +   ├─ kubernetes:helm.sh/v3:Chart                                    aws-ebs-csi-driver                                           created (1s)
 +   └─ kubernetes:storage.k8s.io/v1:StorageClass                      ebs-sc                                                       created (1s)


Outputs:
    kubeconfig   : {
        apiVersion     : "v1"
        clusters       : [ ... ]
        contexts       : [ ... ]
        current-context: "aws"
        kind           : "Config"
        users          : [ ... ]
    }

Resources:
    + 82 created

Duration: 15m11s
```
The update takes 15-20 minutes and will create the following resources on AWS:
* A VPC in the region, with public & private subnets across the region's 2 availability zones.
* The IAM Role for node group.
* An EKS cluster with v1.26 of Kubernetes.
* An EBS CSI Driver and an EBS StorageClass.
* Four different managed node groups for default, pd, tikv, tidb.

Once the update is complete, verify the cluster, node groups, and Pods are up and running:
```
$ pulumi stack output kubeconfig > kubeconfig.yml && export KUBECONFIG=$PWD/kubeconfig.yml

$ kubectl get nodes -l serverless.tidbcloud.com/node=default
NAME                           STATUS   ROLES    AGE   VERSION
ip-10-0-249-216.ec2.internal   Ready    <none>   17m   v1.26.4-eks-0a21954
ip-10-0-47-121.ec2.internal    Ready    <none>   17m   v1.26.4-eks-0a21954
$ kubectl get nodes -l serverless.tidbcloud.com/node=pd
NAME                           STATUS   ROLES    AGE   VERSION
ip-10-0-14-145.ec2.internal    Ready    <none>   17m   v1.26.4-eks-0a21954
ip-10-0-239-175.ec2.internal   Ready    <none>   17m   v1.26.4-eks-0a21954
ip-10-0-49-112.ec2.internal    Ready    <none>   17m   v1.26.4-eks-0a21954
$ kubectl get nodes -l serverless.tidbcloud.com/node=tikv
NAME                           STATUS   ROLES    AGE   VERSION
ip-10-0-105-226.ec2.internal   Ready    <none>   17m   v1.26.4-eks-0a21954
ip-10-0-139-243.ec2.internal   Ready    <none>   17m   v1.26.4-eks-0a21954
ip-10-0-174-179.ec2.internal   Ready    <none>   17m   v1.26.4-eks-0a21954
$ kubectl get nodes -l serverless.tidbcloud.com/node=tidb
NAME                           STATUS   ROLES    AGE   VERSION
ip-10-0-157-80.ec2.internal    Ready    <none>   17m   v1.26.4-eks-0a21954
ip-10-0-211-49.ec2.internal    Ready    <none>   17m   v1.26.4-eks-0a21954

$ kubectl -n kube-system get po -o wide
NAME                                 READY   STATUS    RESTARTS   AGE   IP             NODE
aws-node-4cl72                       1/1     Running   0          14m   10.0.157.80    ip-10-0-157-80.ec2.internal
aws-node-6n8lp                       1/1     Running   0          14m   10.0.139.243   ip-10-0-139-243.ec2.internal
aws-node-f26sq                       1/1     Running   0          14m   10.0.105.226   ip-10-0-105-226.ec2.internal
aws-node-gtn8j                       1/1     Running   0          14m   10.0.249.216   ip-10-0-249-216.ec2.internal
aws-node-gvzj2                       1/1     Running   0          14m   10.0.47.121    ip-10-0-47-121.ec2.internal
aws-node-hl5m8                       1/1     Running   0          14m   10.0.174.179   ip-10-0-174-179.ec2.internal
aws-node-l8nv6                       1/1     Running   0          14m   10.0.49.112    ip-10-0-49-112.ec2.internal
aws-node-lzx8z                       1/1     Running   0          14m   10.0.239.175   ip-10-0-239-175.ec2.internal
aws-node-ndzx5                       1/1     Running   0          14m   10.0.14.145    ip-10-0-14-145.ec2.internal
aws-node-rcqhd                       1/1     Running   0          14m   10.0.211.49    ip-10-0-211-49.ec2.internal
coredns-55fb5d545d-gbcfp             1/1     Running   0          20m   10.0.9.146     ip-10-0-47-121.ec2.internal
coredns-55fb5d545d-q9qdd             1/1     Running   0          20m   10.0.39.95     ip-10-0-47-121.ec2.internal
ebs-csi-controller-78dc48fd5-k5qx6   5/5     Running   0          13m   10.0.219.129   ip-10-0-249-216.ec2.internal
ebs-csi-controller-78dc48fd5-rkdkq   5/5     Running   0          13m   10.0.35.78     ip-10-0-47-121.ec2.internal
ebs-csi-node-42jp5                   3/3     Running   0          13m   10.0.39.101    ip-10-0-14-145.ec2.internal
ebs-csi-node-69kwh                   3/3     Running   0          13m   10.0.245.143   ip-10-0-249-216.ec2.internal
ebs-csi-node-7zj8r                   3/3     Running   0          13m   10.0.193.162   ip-10-0-211-49.ec2.internal
ebs-csi-node-9c6bz                   3/3     Running   0          13m   10.0.46.50     ip-10-0-49-112.ec2.internal
ebs-csi-node-9mjn7                   3/3     Running   0          13m   10.0.108.160   ip-10-0-105-226.ec2.internal
ebs-csi-node-f8mgr                   3/3     Running   0          13m   10.0.60.14     ip-10-0-47-121.ec2.internal
ebs-csi-node-jzfx4                   3/3     Running   0          13m   10.0.244.98    ip-10-0-239-175.ec2.internal
ebs-csi-node-kwt7f                   3/3     Running   0          13m   10.0.128.146   ip-10-0-157-80.ec2.internal
ebs-csi-node-rqkmn                   3/3     Running   0          13m   10.0.163.217   ip-10-0-139-243.ec2.internal
ebs-csi-node-zhzrf                   3/3     Running   0          13m   10.0.154.176   ip-10-0-174-179.ec2.internal
kube-proxy-4hnsn                     1/1     Running   0          14m   10.0.14.145    ip-10-0-14-145.ec2.internal
kube-proxy-749hn                     1/1     Running   0          14m   10.0.249.216   ip-10-0-249-216.ec2.internal
kube-proxy-7j4h2                     1/1     Running   0          14m   10.0.49.112    ip-10-0-49-112.ec2.internal
kube-proxy-g4lzv                     1/1     Running   0          14m   10.0.239.175   ip-10-0-239-175.ec2.internal
kube-proxy-hcwqw                     1/1     Running   0          14m   10.0.157.80    ip-10-0-157-80.ec2.internal
kube-proxy-hxlvr                     1/1     Running   0          14m   10.0.211.49    ip-10-0-211-49.ec2.internal
kube-proxy-jm7n6                     1/1     Running   0          14m   10.0.139.243   ip-10-0-139-243.ec2.internal
kube-proxy-tr4v8                     1/1     Running   0          14m   10.0.174.179   ip-10-0-174-179.ec2.internal
kube-proxy-ttjhj                     1/1     Running   0          14m   10.0.47.121    ip-10-0-47-121.ec2.internal
kube-proxy-z6cms                     1/1     Running   0          14m   10.0.105.226   ip-10-0-105-226.ec2.internal
```
Verify the EBS StorageClass is ready.
```
$ kubectl -n kube-system get sc
NAME            PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
ebs-sc          ebs.csi.aws.com         Delete          WaitForFirstConsumer   true                   14m
```

### Deploying Shared Storage TiDB Cluster
Set the Pulumi configuration variables for the shared storage TiDB cluster.
```
$ pulumi config set pulumi-shared-storage-tidb:cluster-autoscaler-enabled true
$ pulumi config set pulumi-shared-storage-tidb:tidb-operator-enabled true
$ pulumi config set pulumi-shared-storage-tidb:serverless-enabled true
```
Deploy the shared storage TiDB cluster by running `pulumi up`.
```
$ pulumi up
Updating (dev-us-east-1-f01)

     Type                                                               Name                                           Status
     pulumi:pulumi:Stack                                                pulumi-shared-storage-tidb-dev-us-east-1-f01
 +   ├─ aws:iam:Role                                                    cluster-autoscaler-dev                         created (2s)
     ├─ eks:index:Cluster                                               dev-us-east-1-f01-cluster
 +   ├─ kubernetes:core/v1:ServiceAccount                               cluster-autoscaler                             created (1s)
 +   ├─ aws:iam:RolePolicy                                              cluster-autoscaler-dev                         created (1s)
 +   ├─ kubernetes:yaml:ConfigFile                                      tidb-operator-crds                             created (2s)
 +   ├─ kubernetes:helm.sh/v3:Chart                                     aws-cluster-auto-scaler                        created (3s)
 +   ├─ kubernetes:helm.sh/v3:Release                                   tidb-operator                                  created (27s)
 +   ├─ kubernetes:core/v1:Namespace                                    dev-us-east-1-f01-serverless-ns                created (2s)
 +   ├─ kubernetes:yaml:ConfigFile                                      dev-us-east-1-f01-serverless-cluster-tenant-1  created (3s)
 +   ├─ kubernetes:yaml:ConfigFile                                      dev-us-east-1-f01-serverless-cluster-tenant-2  created (5s)
 +   └─ kubernetes:yaml:ConfigFile                                      dev-us-east-1-f01-serverless-cluster           created (6s)


Outputs:
    kubeconfig   : { ... }

Resources:
    + 29 created
    82 unchanged

Duration: 1m8s
```
The update takes ~2 minutes and will create the following resources on AWS:
* An Cluster Autoscaler.
* An TiDB Operator.
* A shared TiKV Cluster, a shared PD cluster and two tenant TiDB cluster.
```
$ pulumi stack output kubeconfig > kubeconfig.yml && export KUBECONFIG=$PWD/kubeconfig.yml

$ kubectl -n kube-system get po -o wide
NAME                                       READY   STATUS    RESTARTS   AGE
cluster-autoscaler-6d9499f467-jk8p7        1/1     Running   0          10m   10.0.212.69    ip-10-0-249-216.ec2.internal
cluster-autoscaler-6d9499f467-wrgh2        1/1     Running   0          10m   10.0.29.176    ip-10-0-47-121.ec2.internal
tidb-controller-manager-55879b6bc8-x2hmp   1/1     Running   0          10m   10.0.202.26    ip-10-0-249-216.ec2.internal
tidb-scheduler-55fb8b865f-htp22            2/2     Running   0          10m   10.0.196.152   ip-10-0-249-216.ec2.internal
... pods ...

$ kubectl -n tidb-serverless get po -o wide
NAME                                            READY   STATUS    RESTARTS   AGE   IP             NODE
serverless-cluster-discovery-758986865f-766w6   1/1     Running   0          11m   10.0.21.100    ip-10-0-47-121.ec2.internal
serverless-cluster-pd-0                         1/1     Running   0          11m   10.0.25.13     ip-10-0-49-112.ec2.internal
serverless-cluster-tenant-1-tidb-0              2/2     Running   0          11m   10.0.141.42    ip-10-0-157-80.ec2.internal
serverless-cluster-tenant-2-tidb-0              2/2     Running   0          11m   10.0.249.103   ip-10-0-211-49.ec2.internal
serverless-cluster-tidb-0                       2/2     Running   0          10m   10.0.22.155    ip-10-0-47-121.ec2.internal
serverless-cluster-tikv-0                       1/1     Running   0          11m   10.0.142.243   ip-10-0-174-179.ec2.internal
serverless-cluster-tikv-1                       1/1     Running   0          11m   10.0.77.2      ip-10-0-105-226.ec2.internal
serverless-cluster-tikv-2                       1/1     Running   0          11m   10.0.149.226   ip-10-0-139-243.ec2.internal
```

## License
This package is licensed under a MIT license (Copyright (c) 2023 Meng Huang)

## Author
pulumi-shared-storage-tidb was written by Meng Huang.
