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
Set the Pulumi configuration variables for the EKS cluster.
```
$ pulumi config set pulumi-shared-storage-tidb:nodegroup-enabled true
```
Create the EKS cluster by running an update:
```
$ pulumi up
Updating (dev-us-east-1-f01)

     Type                                                              Name                                                         Status              
 +   pulumi:pulumi:Stack                                               pulumi-shared-storage-tidb-dev-us-east-1-f01                 created (732s)      
 +   ├─ awsx:x:ec2:Vpc                                                 dev-us-east-1-f01-vpc                                        created (4s)        
 +   ├─ eks:index:Cluster                                              dev-us-east-1-f01-cluster                                    created (730s)      
 +   ├─ aws:iam:Role                                                   dev-us-east-1-f01-managed-nodegroup-role                     created (2s)        
 +   ├─ aws:iam:InstanceProfile                                        dev-us-east-1-f01-instance-profile                           created (2s)        
 +   ├─ eks:index:ManagedNodeGroup                                     dev-us-east-1-f01-tikv-standard-0                            created (4s)        
 +   │  └─ aws:eks:NodeGroup                                           dev-us-east-1-f01-tikv-standard-0                            created (153s)      
 +   ├─ eks:index:ManagedNodeGroup                                     dev-us-east-1-f01-pd-standard-0                              created (6s)        
 +   │  └─ aws:eks:NodeGroup                                           dev-us-east-1-f01-pd-standard-0                              created (142s)      
 +   ├─ eks:index:ManagedNodeGroup                                     dev-us-east-1-f01-tidb-standard-0                            created (8s)        
 +   │  └─ aws:eks:NodeGroup                                           dev-us-east-1-f01-tidb-standard-0                            created (153s)      
 +   ├─ eks:index:ManagedNodeGroup                                     dev-us-east-1-f01-default-standard-0                         created (9s)        
 +   │  └─ aws:eks:NodeGroup                                           dev-us-east-1-f01-default-standard-0                         created (164s)      
 +   ├─ kubernetes:helm.sh/v3:Chart                                    aws-ebs-csi-driver                                           created (1s)        
 +   │  ├─ kubernetes:apps/v1:DaemonSet                                kube-system/ebs-csi-node                                     created (5s)        
 +   │  └─ kubernetes:apps/v1:Deployment                               kube-system/ebs-csi-controller                               created (129s)      
 +   └─ kubernetes:storage.k8s.io/v1:StorageClass                      ebs-sc                                                       created (0.97s)     


Outputs:
    kubeconfig            : {
        apiVersion     : "v1"
        clusters       : [
            ...
        ]
        contexts       : [
            ...
        ]
        current-context: "aws"
        kind           : "Config"
        users          : [
            ...
        ]
    }

Resources:
    + 82 created

Duration: 15m14s
```
The update takes ~16 minutes and will create the following resources on AWS:
* A VPC in the region, with public & private subnets across the region's 2 availability zones.
* The IAM Role & Instance Profile for node group.
* An EKS cluster with v1.26 of Kubernetes.
* An EBS CSI Driver and an EBS StorageClass.
* Four different managed node groups for default, pd, tikv, tidb.

Once the update is complete, verify the cluster, node groups, and Pods are up and running:
```
$ pulumi stack output kubeconfig > kubeconfig.yml && export KUBECONFIG=$PWD/kubeconfig.yml

$ kubectl get nodes
NAME                           STATUS   ROLES    AGE   VERSION
ip-10-0-120-200.ec2.internal   Ready    <none>   20m   v1.24.13-eks-0a21954
ip-10-0-121-198.ec2.internal   Ready    <none>   20m   v1.24.13-eks-0a21954
ip-10-0-149-109.ec2.internal   Ready    <none>   20m   v1.24.13-eks-0a21954
ip-10-0-164-210.ec2.internal   Ready    <none>   20m   v1.24.13-eks-0a21954
ip-10-0-20-145.ec2.internal    Ready    <none>   20m   v1.24.13-eks-0a21954
ip-10-0-21-237.ec2.internal    Ready    <none>   20m   v1.24.13-eks-0a21954
ip-10-0-33-44.ec2.internal     Ready    <none>   20m   v1.24.13-eks-0a21954
ip-10-0-41-169.ec2.internal    Ready    <none>   19m   v1.24.13-eks-0a21954
ip-10-0-45-15.ec2.internal     Ready    <none>   20m   v1.24.13-eks-0a21954
ip-10-0-74-106.ec2.internal    Ready    <none>   20m   v1.24.13-eks-0a21954
ip-10-0-96-115.ec2.internal    Ready    <none>   19m   v1.24.13-eks-0a21954

$ kubectl get pods --all-namespaces -o wide
NAME                                       READY   STATUS    RESTARTS   AGE
aws-node-2bscq                             1/1     Running   0          20m
aws-node-65hz2                             1/1     Running   0          20m
aws-node-h9zbb                             1/1     Running   0          20m
aws-node-mckhs                             1/1     Running   0          20m
aws-node-mhx89                             1/1     Running   0          20m
aws-node-p4ldq                             1/1     Running   0          20m
aws-node-pzzpz                             1/1     Running   0          19m
aws-node-rpdrh                             1/1     Running   0          20m
aws-node-s28m7                             1/1     Running   0          19m
aws-node-w96mk                             1/1     Running   0          20m
aws-node-zsdmj                             1/1     Running   0          20m
coredns-79989457d9-jbps8                   1/1     Running   0          26m
coredns-79989457d9-n84g5                   1/1     Running   0          26m
ebs-csi-controller-6b7bc4c65c-cqpsd        5/5     Running   0          20m
ebs-csi-controller-6b7bc4c65c-nqpcm        5/5     Running   0          20m
ebs-csi-node-4vfdk                         3/3     Running   0          20m
ebs-csi-node-7b2jq                         3/3     Running   0          20m
ebs-csi-node-brtqw                         3/3     Running   0          20m
ebs-csi-node-j9lzr                         3/3     Running   0          20m
ebs-csi-node-mfmp4                         3/3     Running   0          20m
ebs-csi-node-n6gxz                         3/3     Running   0          20m
ebs-csi-node-nhnb7                         3/3     Running   0          20m
ebs-csi-node-qpvlj                         3/3     Running   0          20m
ebs-csi-node-qx4cv                         3/3     Running   0          19m
ebs-csi-node-vmjj6                         3/3     Running   0          20m
ebs-csi-node-wjpqt                         3/3     Running   0          19m
kube-proxy-4kcrj                           1/1     Running   0          20m
kube-proxy-5jfq2                           1/1     Running   0          20m
kube-proxy-8tl7h                           1/1     Running   0          20m
kube-proxy-92nbt                           1/1     Running   0          20m
kube-proxy-99nsj                           1/1     Running   0          20m
kube-proxy-cpj8b                           1/1     Running   0          20m
kube-proxy-jz7v4                           1/1     Running   0          19m
kube-proxy-lmh7x                           1/1     Running   0          20m
kube-proxy-qmplb                           1/1     Running   0          19m
kube-proxy-vqf9t                           1/1     Running   0          20m
kube-proxy-x745x                           1/1     Running   0          20m

```
Verify the EBS StorageClass is ready:
```
$ kubectl -n kube-system get sc
NAME            PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
ebs-sc          ebs.csi.aws.com         Delete          WaitForFirstConsumer   true                   19m
gp2 (default)   kubernetes.io/aws-ebs   Delete          WaitForFirstConsumer   false                  27m
```

### Deploying Shared Storage TiDB Cluster
Set the Pulumi configuration variables for the shared storage TiDB cluster.
```
$ pulumi config set pulumi-shared-storage-tidb:nodegroup-enabled true
$ pulumi config set pulumi-shared-storage-tidb:cluster-autoscaler-enabled true
$ pulumi config set pulumi-shared-storage-tidb:tidb-operator-enabled true
$ pulumi config set pulumi-shared-storage-tidb:serverless-enabled true
```
Deploy the shared storage TiDB cluster by running an update:
```
$ pulumi up
Updating (dev-us-east-1-f01)

     Type                                                               Name                                           Status            
     pulumi:pulumi:Stack                                                pulumi-shared-storage-tidb-dev-us-east-1-f01                     
     ├─ eks:index:Cluster                                               dev-us-east-1-f01-cluster                                        
     │  └─ aws:eks:Cluster                                              dev-us-east-1-f01-cluster-eksCluster                             
 +   ├─ kubernetes:helm.sh/v3:Release                                   tidb-operator                                  created (33s)     
 +   ├─ kubernetes:yaml:ConfigFile                                      tidb-operator-crds                             created (5s)      
 +   │  └─ kubernetes:apiextensions.k8s.io/v1:CustomResourceDefinition  tidbclusters.pingcap.com                       created (15s)  
      ... crds ...
 +   ├─ kubernetes:core/v1:ServiceAccount                               cluster-autoscaler                             created (2s)      
      ... autoscaler ...
 +   │  └─ kubernetes:apps/v1:Deployment                                kube-system/cluster-autoscaler                 created (9s)      
 +   ├─ kubernetes:core/v1:Namespace                                    dev-us-east-1-f01-serverless-ns                created (1s)      
 +   ├─ kubernetes:yaml:ConfigFile                                      dev-us-east-1-f01-serverless-cluster           created (3s)      
 +   ├─ kubernetes:yaml:ConfigFile                                      dev-us-east-1-f01-serverless-cluster-tenant-2  created (5s)      
 +   └─ kubernetes:yaml:ConfigFile                                      dev-us-east-1-f01-serverless-cluster-tenant-1  created (6s)      

Outputs:
...

Resources:
    + 29 created
    95 unchanged

Duration: 1m57s
```
The update takes ~2 minutes and will create the following resources on AWS:
* An Cluster Autoscaler.
* An TiDB Operator.
* A shared TiKV Cluster, a shared PD cluster and two tenant TiDB cluster.
```
$ pulumi stack output kubeconfig > kubeconfig.yml && export KUBECONFIG=$PWD/kubeconfig.yml

$ kubectl -n kube-system get po
NAME                                       READY   STATUS    RESTARTS   AGE
... pods ...
cluster-autoscaler-58b78b86c6-2hh9j        1/1     Running   0          113s
cluster-autoscaler-58b78b86c6-zmlc2        1/1     Running   0          113s
tidb-controller-manager-759cbdc944-twptw   1/1     Running   0          119s
tidb-scheduler-6dcb7fb7b7-sx926            2/2     Running   0          119s

$ kubectl -n tidb-serverless get po
NAME                                            READY   STATUS    RESTARTS   AGE
serverless-cluster-discovery-64bd86cfc8-8cslw   1/1     Running   0          2m44s
serverless-cluster-pd-0                         1/1     Running   0          2m44s
serverless-cluster-tenant-1-tidb-0              2/2     Running   0          2m41s
serverless-cluster-tenant-2-tidb-0              2/2     Running   0          2m42s
serverless-cluster-tidb-0                       2/2     Running   0          89s
serverless-cluster-tikv-0                       1/1     Running   0          2m13s
serverless-cluster-tikv-1                       1/1     Running   0          2m13s
serverless-cluster-tikv-2                       1/1     Running   0          2m13s
```

## License
This package is licensed under a MIT license (Copyright (c) 2023 Meng Huang)

## Author
pulumi-shared-storage-tidb was written by Meng Huang.
