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
1. Start by cloning the [pulumi-shared-storage-tidb](https://github.com/hslam/pulumi-shared-storage-tidb) to your local machine.
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

     Type                                    Name                                                         Status              
 +   pulumi:pulumi:Stack                     pulumi-shared-storage-tidb-dev-us-east-1-f01                 created (738s)      
 +   ├─ awsx:x:ec2:Vpc                       dev-us-east-1-f01-vpc                                        created (3s)        
 +   ├─ eks:index:Cluster                    dev-us-east-1-f01-cluster                                    created (734s)      
 +   ├─ aws:iam:Role                         dev-us-east-1-f01-managed-nodegroup-role                     created (2s)        
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1c-tikv-standard-0                 created (4s)        
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1a-pd-standard-0                   created (7s)        
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-tidb-standard-0                            created (8s)        
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1c-pd-standard-0                   created (9s)        
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1b-tikv-standard-0                 created (10s)       
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1b-pd-standard-0                   created (10s)       
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-default-standard-0                         created (11s)       
 +   └─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1a-tikv-standard-0                 created (11s)       

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
    + 83 created

Duration: 15m10s
```
The update takes 15-20 minutes and will create the following resources on AWS:
* A VPC in the region, with public & private subnets across the region's 3 availability zones.
* The IAM Role for node group.
* An EKS cluster with v1.26 of Kubernetes.
* Create an ASG across multiple AZs for each component `default, tidb`.
* Create multiple ASGs for each component `pd, tikv` with one ASG per AZ.

Once the update is complete, verify the cluster, node groups, and Pods are up and running:
```
$ pulumi stack output kubeconfig > kubeconfig.yml && export KUBECONFIG=$PWD/kubeconfig.yml

$ kubectl get nodes -l serverless=default
NAME                           STATUS   ROLES    AGE     VERSION
ip-10-0-103-193.ec2.internal   Ready    <none>   4m53s   v1.26.4-eks-0a21954
ip-10-0-142-148.ec2.internal   Ready    <none>   5m11s   v1.26.4-eks-0a21954

$ kubectl get nodes -l serverless=pd
NAME                           STATUS   ROLES    AGE     VERSION
ip-10-0-112-81.ec2.internal    Ready    <none>   4m55s   v1.26.4-eks-0a21954
ip-10-0-156-152.ec2.internal   Ready    <none>   5m37s   v1.26.4-eks-0a21954
ip-10-0-165-88.ec2.internal    Ready    <none>   5m13s   v1.26.4-eks-0a21954

$ kubectl get nodes -l serverless=tikv
NAME                           STATUS   ROLES    AGE     VERSION
ip-10-0-111-58.ec2.internal    Ready    <none>   5m13s   v1.26.4-eks-0a21954
ip-10-0-153-52.ec2.internal    Ready    <none>   5m10s   v1.26.4-eks-0a21954
ip-10-0-163-161.ec2.internal   Ready    <none>   5m41s   v1.26.4-eks-0a21954

$ kubectl get nodes -l serverless=tidb
NAME                           STATUS   ROLES    AGE     VERSION
ip-10-0-127-213.ec2.internal   Ready    <none>   5m33s   v1.26.4-eks-0a21954
ip-10-0-182-86.ec2.internal    Ready    <none>   5m41s   v1.26.4-eks-0a21954


$ kubectl label --list nodes -l serverless=default | grep "topology.kubernetes.io/zone"
 topology.kubernetes.io/zone=us-east-1a
 topology.kubernetes.io/zone=us-east-1b

$ kubectl label --list nodes -l serverless=pd | grep "topology.kubernetes.io/zone"
 topology.kubernetes.io/zone=us-east-1a
 topology.kubernetes.io/zone=us-east-1b
 topology.kubernetes.io/zone=us-east-1c

$ kubectl label --list nodes -l serverless=tikv | grep "topology.kubernetes.io/zone"
 topology.kubernetes.io/zone=us-east-1a
 topology.kubernetes.io/zone=us-east-1b
 topology.kubernetes.io/zone=us-east-1c

$ kubectl label --list nodes -l serverless=tidb | grep "topology.kubernetes.io/zone"
 topology.kubernetes.io/zone=us-east-1a
 topology.kubernetes.io/zone=us-east-1c


$ kubectl -n kube-system get po -o wide
NAME                       READY   STATUS    RESTARTS   AGE     IP             NODE                           NOMINATED NODE   READINESS GATES
aws-node-2qfcv             1/1     Running   0          7m45s   10.0.111.58    ip-10-0-111-58.ec2.internal    <none>           <none>
aws-node-55r8p             1/1     Running   0          8m4s    10.0.182.86    ip-10-0-182-86.ec2.internal    <none>           <none>
aws-node-64fdw             1/1     Running   0          7m43s   10.0.103.193   ip-10-0-103-193.ec2.internal   <none>           <none>
aws-node-fbdlm             1/1     Running   0          8m17s   10.0.156.152   ip-10-0-156-152.ec2.internal   <none>           <none>
aws-node-lfqdb             1/1     Running   0          7m35s   10.0.112.81    ip-10-0-112-81.ec2.internal    <none>           <none>
aws-node-mt9hw             1/1     Running   0          8m13s   10.0.163.161   ip-10-0-163-161.ec2.internal   <none>           <none>
aws-node-p6mhl             1/1     Running   0          7m42s   10.0.153.52    ip-10-0-153-52.ec2.internal    <none>           <none>
aws-node-qnx25             1/1     Running   0          7m56s   10.0.127.213   ip-10-0-127-213.ec2.internal   <none>           <none>
aws-node-r7r7r             1/1     Running   0          7m53s   10.0.165.88    ip-10-0-165-88.ec2.internal    <none>           <none>
aws-node-svfwc             1/1     Running   0          8m1s    10.0.142.148   ip-10-0-142-148.ec2.internal   <none>           <none>
coredns-55fb5d545d-22fhz   1/1     Running   0          14m     10.0.146.242   ip-10-0-142-148.ec2.internal   <none>           <none>
coredns-55fb5d545d-jhpnn   1/1     Running   0          14m     10.0.129.82    ip-10-0-142-148.ec2.internal   <none>           <none>
kube-proxy-6zt86           1/1     Running   0          7m45s   10.0.111.58    ip-10-0-111-58.ec2.internal    <none>           <none>
kube-proxy-9z6k4           1/1     Running   0          8m17s   10.0.156.152   ip-10-0-156-152.ec2.internal   <none>           <none>
kube-proxy-bb59t           1/1     Running   0          8m13s   10.0.163.161   ip-10-0-163-161.ec2.internal   <none>           <none>
kube-proxy-h5qxg           1/1     Running   0          7m56s   10.0.127.213   ip-10-0-127-213.ec2.internal   <none>           <none>
kube-proxy-jc26k           1/1     Running   0          7m35s   10.0.112.81    ip-10-0-112-81.ec2.internal    <none>           <none>
kube-proxy-kh88n           1/1     Running   0          8m4s    10.0.182.86    ip-10-0-182-86.ec2.internal    <none>           <none>
kube-proxy-m6lp6           1/1     Running   0          7m53s   10.0.165.88    ip-10-0-165-88.ec2.internal    <none>           <none>
kube-proxy-pmt82           1/1     Running   0          8m1s    10.0.142.148   ip-10-0-142-148.ec2.internal   <none>           <none>
kube-proxy-qxsds           1/1     Running   0          7m43s   10.0.103.193   ip-10-0-103-193.ec2.internal   <none>           <none>
kube-proxy-r7w88           1/1     Running   0          7m42s   10.0.153.52    ip-10-0-153-52.ec2.internal    <none>           <none>
```
### Deploying Control Plane
Set the Pulumi configuration variables for the control plane.
```
$ pulumi config set pulumi-shared-storage-tidb:control-plane-enabled true
```
Deploy the control plane components by running `pulumi up`.
```
$ pulumi up
Updating (dev-us-east-1-f01)

     Type                                                               Name                                          Status            
     pulumi:pulumi:Stack                                                pulumi-shared-storage-tidb-dev-us-east-1-f01                    
     ├─ eks:index:Cluster                                               dev-us-east-1-f01-cluster                                       
 +   ├─ kubernetes:helm.sh/v3:Chart                                     aws-cluster-auto-scaler                       created (1s)      
 +   ├─ kubernetes:helm.sh/v3:Chart                                     aws-ebs-csi-driver                            created (2s)      
 +   ├─ kubernetes:yaml:ConfigFile                                      tidb-operator-crds                            created (3s)      
 +   ├─ kubernetes:helm.sh/v3:Release                                   tidb-operator                                 created (26s)     
 +   └─ kubernetes:storage.k8s.io/v1:StorageClass                       ebs-sc                                        created (1s)      

Outputs:
    kubeconfig   : { ... }

Resources:
    + 42 created
    83 unchanged

Duration: 59s
```
The update takes ~1 minutes and will create the following resources on AWS:
* An Cluster Autoscaler for node group.
* An EBS CSI Driver and an EBS StorageClass.
* TiDB Operator CRDs and an TiDB Operator.

Confirm that the control plane components are running, run the following command.
```
$ kubectl -n kube-system get po -o wide
NAME                                       READY   STATUS    RESTARTS   AGE     IP             NODE                           NOMINATED NODE   READINESS GATES
cluster-autoscaler-6d9499f467-hnfrr        1/1     Running   0          4m32s   10.0.149.2     ip-10-0-142-148.ec2.internal   <none>           <none>
cluster-autoscaler-6d9499f467-vsfjw        1/1     Running   0          4m32s   10.0.120.139   ip-10-0-103-193.ec2.internal   <none>           <none>
ebs-csi-controller-78dc48fd5-2rm4v         5/5     Running   0          4m28s   10.0.132.4     ip-10-0-142-148.ec2.internal   <none>           <none>
ebs-csi-controller-78dc48fd5-txvq2         5/5     Running   0          4m28s   10.0.124.98    ip-10-0-103-193.ec2.internal   <none>           <none>
ebs-csi-node-7ztw5                         3/3     Running   0          4m27s   10.0.155.116   ip-10-0-156-152.ec2.internal   <none>           <none>
ebs-csi-node-9dxn5                         3/3     Running   0          4m27s   10.0.167.179   ip-10-0-163-161.ec2.internal   <none>           <none>
ebs-csi-node-b8tcm                         3/3     Running   0          4m28s   10.0.172.123   ip-10-0-165-88.ec2.internal    <none>           <none>
ebs-csi-node-m2bsx                         3/3     Running   0          4m28s   10.0.125.19    ip-10-0-103-193.ec2.internal   <none>           <none>
ebs-csi-node-md7lg                         3/3     Running   0          4m28s   10.0.191.167   ip-10-0-182-86.ec2.internal    <none>           <none>
ebs-csi-node-pmsvm                         3/3     Running   0          4m28s   10.0.127.242   ip-10-0-112-81.ec2.internal    <none>           <none>
ebs-csi-node-qtrpf                         3/3     Running   0          4m28s   10.0.149.189   ip-10-0-153-52.ec2.internal    <none>           <none>
ebs-csi-node-w58xm                         3/3     Running   0          4m28s   10.0.110.0     ip-10-0-127-213.ec2.internal   <none>           <none>
ebs-csi-node-wlqv2                         3/3     Running   0          4m28s   10.0.128.194   ip-10-0-142-148.ec2.internal   <none>           <none>
ebs-csi-node-x7xsl                         3/3     Running   0          4m28s   10.0.114.42    ip-10-0-111-58.ec2.internal    <none>           <none>
tidb-controller-manager-65f65bd6d5-f27rg   1/1     Running   0          4m20s   10.0.126.143   ip-10-0-103-193.ec2.internal   <none>           <none>
tidb-scheduler-66cf6f7f56-d4m6j            2/2     Running   0          4m20s   10.0.127.180   ip-10-0-103-193.ec2.internal   <none>           <none>
... other pods ...
```
Verify the `gp3` EBS StorageClass is ready.
```
$ kubectl -n kube-system get sc
NAME            PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
ebs-sc          ebs.csi.aws.com         Delete          WaitForFirstConsumer   true                   5m9s

$ kubectl -n kube-system describe sc ebs-sc
Name:            ebs-sc
Provisioner:           ebs.csi.aws.com
Parameters:            type=gp3
AllowVolumeExpansion:  True
MountOptions:
  nodelalloc
  noatime
ReclaimPolicy:      Delete
VolumeBindingMode:  WaitForFirstConsumer
```

### Deploying Shared Storage TiDB Cluster
Set the Pulumi configuration variables for the shared storage TiDB cluster.
* Set a password for each tenant.
* Enable the shared storage TiDB cluster.
```
$ export PASSWORD_TENANT_1="admin-1"
$ export PASSWORD_TENANT_2="admin-2"
$ pulumi config set --path 'pulumi-shared-storage-tidb:serverless-keyspaces[0].rootPassword' "${PASSWORD_TENANT_1}"
$ pulumi config set --path 'pulumi-shared-storage-tidb:serverless-keyspaces[1].rootPassword' "${PASSWORD_TENANT_2}"
$ pulumi config set pulumi-shared-storage-tidb:serverless-enabled true
```
Deploy the shared storage TiDB cluster by running `pulumi up`.
```
$ pulumi up
Updating (dev-us-east-1-f01)

     Type                                                   Name                                               Status            
     pulumi:pulumi:Stack                                    pulumi-shared-storage-tidb-dev-us-east-1-f01                         
     ├─ eks:index:Cluster                                   dev-us-east-1-f01-cluster                                            
 +   ├─ kubernetes:core/v1:Namespace                        dev-us-east-1-f01-serverless-ns                    created (1s)      
 +   ├─ kubernetes:yaml:ConfigFile                          dev-us-east-1-f01-serverless-cluster-tenant-1      created (5s)      
 +   ├─ kubernetes:core/v1:Secret                           dev-us-east-1-f01-serverless-secret-tenant-2       created (2s)      
 +   ├─ kubernetes:yaml:ConfigFile                          dev-us-east-1-f01-serverless-cluster               created (8s)      
 +   ├─ kubernetes:core/v1:Secret                           dev-us-east-1-f01-serverless-secret-tenant-1       created (4s)      
 +   ├─ kubernetes:yaml:ConfigFile                          dev-us-east-1-f01-serverless-cluster-tenant-2      created (10s)     
 +   ├─ kubernetes:yaml:ConfigFile                          dev-us-east-1-f01-serverless-initializer-tenant-2  created (3s)      
 +   └─ kubernetes:yaml:ConfigFile                          dev-us-east-1-f01-serverless-initializer-tenant-1  created (4s)      

Outputs:
    kubeconfig   : { ... }

Resources:
    + 13 created
    125 unchanged

Duration: 1m1s
```
The update takes ~1 minutes and will create the following resources on AWS:
* A tidb-serverless namespace.
* A shared PD cluster.
* A shared TiKV cluster.
* An TiDB cluster as GC workers.
* Two tenant TiDB cluster.

View the Namespace status.
```
$ kubectl get ns
NAME              STATUS   AGE
default           Active   25m
kube-node-lease   Active   25m
kube-public       Active   25m
kube-system       Active   25m
tidb-serverless   Active   5m
```
View the Pod status in the tidb-serverless namespace.
```
$ kubectl -n tidb-serverless get po -o wide -l app.kubernetes.io/component=pd
NAME                      READY   STATUS    RESTARTS        AGE     IP             NODE                           NOMINATED NODE   READINESS GATES
serverless-cluster-pd-0   1/1     Running   1 (4m38s ago)   5m17s   10.0.116.74    ip-10-0-112-81.ec2.internal    <none>           <none>
serverless-cluster-pd-1   1/1     Running   0               5m16s   10.0.171.108   ip-10-0-165-88.ec2.internal    <none>           <none>
serverless-cluster-pd-2   1/1     Running   0               5m16s   10.0.137.224   ip-10-0-156-152.ec2.internal   <none>           <none>

$ kubectl -n tidb-serverless get po -o wide -l app.kubernetes.io/component=tikv
NAME                        READY   STATUS    RESTARTS   AGE     IP             NODE                           NOMINATED NODE   READINESS GATES
serverless-cluster-tikv-0   1/1     Running   0          4m51s   10.0.112.51    ip-10-0-111-58.ec2.internal    <none>           <none>
serverless-cluster-tikv-1   1/1     Running   0          4m50s   10.0.146.217   ip-10-0-153-52.ec2.internal    <none>           <none>
serverless-cluster-tikv-2   1/1     Running   0          4m50s   10.0.178.240   ip-10-0-163-161.ec2.internal   <none>           <none>

$ kubectl -n tidb-serverless get po -o wide -l app.kubernetes.io/component=tidb
NAME                                 READY   STATUS    RESTARTS   AGE     IP             NODE                           NOMINATED NODE   READINESS GATES
serverless-cluster-tenant-1-tidb-0   2/2     Running   0          5m34s   10.0.124.45    ip-10-0-127-213.ec2.internal   <none>           <none>
serverless-cluster-tenant-2-tidb-0   2/2     Running   0          5m32s   10.0.166.111   ip-10-0-182-86.ec2.internal    <none>           <none>
serverless-cluster-tidb-0            2/2     Running   0          4m8s    10.0.105.44    ip-10-0-103-193.ec2.internal   <none>           <none>
```

### Use `kubectl port-forward` to access tenant TiDB service.
* Get a list of TiDB services in the tidb-serverless namespace.
```
$ kubectl -n tidb-serverless get svc -l app.kubernetes.io/component=tidb
NAME                                    TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)              AGE
serverless-cluster-tenant-1-tidb        ClusterIP   172.20.223.105   <none>        4000/TCP,10080/TCP   6m40s
serverless-cluster-tenant-1-tidb-peer   ClusterIP   None             <none>        10080/TCP            6m40s
serverless-cluster-tenant-2-tidb        ClusterIP   172.20.196.108   <none>        4000/TCP,10080/TCP   6m38s
serverless-cluster-tenant-2-tidb-peer   ClusterIP   None             <none>        10080/TCP            6m38s
```
* Forward tenant TiDB port from the local host to the k8s cluster.
```
$ kubectl port-forward -n tidb-serverless svc/serverless-cluster-tenant-1-tidb 14001:4000 > pf14001.out &
$ kubectl port-forward -n tidb-serverless svc/serverless-cluster-tenant-2-tidb 14002:4000 > pf14002.out &
```
* Export the variable of the tenant TiDB service.
```
$ export HOST_TENANT_1=127.0.0.1
$ export HOST_TENANT_2=127.0.0.1

$ export PORT_TENANT_1=14001
$ export PORT_TENANT_2=14002
```

### Expose tenant TiDB service over the internet (Optional).
If you want to expose tenant TiDB service over the internet and if you are aware of the risks of doing this,
you can set the following Pulumi configuration variables.
```
$ pulumi config set --path 'pulumi-shared-storage-tidb:serverless-keyspaces[0].externalIP' true
$ pulumi config set --path 'pulumi-shared-storage-tidb:serverless-keyspaces[1].externalIP' true
```
Expose tenant TiDB service external IP by running `pulumi up`.
```
$ pulumi up
Updating (dev-us-east-1-f01)

     Type                                               Name                                           Status           Info
     pulumi:pulumi:Stack                                pulumi-shared-storage-tidb-dev-us-east-1-f01                    
     ├─ eks:index:Cluster                               dev-us-east-1-f01-cluster                                       
     │  └─ aws:eks:Cluster                              dev-us-east-1-f01-cluster-eksCluster                            
     ├─ kubernetes:yaml:ConfigFile                      dev-us-east-1-f01-serverless-cluster-tenant-1                   
 ~   │  └─ kubernetes:pingcap.com/v1alpha1:TidbCluster  tidb-serverless/serverless-cluster-tenant-1    updated (2s)     [diff: ~spec]
     └─ kubernetes:yaml:ConfigFile                      dev-us-east-1-f01-serverless-cluster-tenant-2                   
 ~      └─ kubernetes:pingcap.com/v1alpha1:TidbCluster  tidb-serverless/serverless-cluster-tenant-2    updated (4s)     [diff: ~spec]

Outputs:
    kubeconfig   : { ... }

Resources:
    ~ 2 updated
    136 unchanged

Duration: 53s
```
* Get a list of TiDB services in the tidb-serverless namespace.
```
$ kubectl -n tidb-serverless get svc -l app.kubernetes.io/component=tidb | grep -v "<none>"
NAME                                    TYPE           CLUSTER-IP       EXTERNAL-IP                                                               PORT(S)                          AGE
serverless-cluster-tenant-1-tidb        LoadBalancer   172.20.223.105   a9d2df18da8764b349454447f1xxxxxx-1568000000.us-east-1.elb.amazonaws.com   4000:30556/TCP,10080:32276/TCP   11m
serverless-cluster-tenant-2-tidb        LoadBalancer   172.20.196.108   a515a70030d5746d4808e6221fxxxxxx-1632000000.us-east-1.elb.amazonaws.com   4000:32728/TCP,10080:31723/TCP   11m
```
* Export the variable of the tenant TiDB service.
```
$ export HOST_TENANT_1=`kubectl -n tidb-serverless get svc -l app.kubernetes.io/component=tidb | grep -v "<none>" | grep tenant-1 |awk '{print $4}'`
$ export HOST_TENANT_2=`kubectl -n tidb-serverless get svc -l app.kubernetes.io/component=tidb | grep -v "<none>" | grep tenant-2 |awk '{print $4}'`

$ export PORT_TENANT_1=4000
$ export PORT_TENANT_2=4000
```

### Access the database.

* Install the MySQL client.

* Access the tenant TiDB service and create a table in the test database.
```
$ mysql --comments -h ${HOST_TENANT_1} -P ${PORT_TENANT_1} -u root --password=${PASSWORD_TENANT_1} \
    -e 'use test; create table if not exists `tenant_1_tbl` (`id` int unsigned auto_increment primary key, `column_name` varchar(100));'
$ mysql --comments -h ${HOST_TENANT_2} -P ${PORT_TENANT_2} -u root --password=${PASSWORD_TENANT_2} \
    -e 'use test; create table if not exists `tenant_2_tbl` (`id` int unsigned auto_increment primary key, `column_name` varchar(100));'

$ mysql --comments -h ${HOST_TENANT_1} -P ${PORT_TENANT_1} -u root --password=${PASSWORD_TENANT_1} \
    -e 'use test; show tables;'
+----------------+
| Tables_in_test |
+----------------+
| tenant_1_tbl   |
+----------------+
$ mysql --comments -h ${HOST_TENANT_2} -P ${PORT_TENANT_2} -u root --password=${PASSWORD_TENANT_2} \
    -e 'use test; show tables;'
+----------------+
| Tables_in_test |
+----------------+
| tenant_2_tbl   |
+----------------+
```

### Destroying Shared Storage TiDB Cluster
* Stop kubectl port forwarding. If you still have running kubectl processes that are forwarding ports, end them.
```
$ pgrep -lfa kubectl
10001 kubectl port-forward -n tidb-serverless svc/serverless-cluster-tenant-1-tidb 14001:4000
10002 kubectl port-forward -n tidb-serverless svc/serverless-cluster-tenant-2-tidb 14002:4000
$ kill 10001 10002
```
* Get a list of `tc` in the tidb-serverless namespace. The `tc` in this command is a short name for tidbclusters.
```
$ kubectl -n tidb-serverless get tc
NAME                          READY   PD                  STORAGE   READY   DESIRE   TIKV                  STORAGE   READY   DESIRE   TIDB                  READY   DESIRE   AGE
serverless-cluster            True    pingcap/pd:v7.1.0   10Gi      3       3        pingcap/tikv:v7.1.0   10Gi      3       3        pingcap/tidb:v7.1.0   1       1        18m
serverless-cluster-tenant-1   True                                                                                                    pingcap/tidb:v7.1.0   1       1        18m
serverless-cluster-tenant-2   True                                                                                                    pingcap/tidb:v7.1.0   1       1        18m                                                                                                pingcap/tidb:v7.1.0   1       1        24m
```
* Delete these `tc` manually.
```
$ kubectl -n tidb-serverless delete tc --all
tidbcluster.pingcap.com "serverless-cluster" deleted
tidbcluster.pingcap.com "serverless-cluster-tenant-1" deleted
tidbcluster.pingcap.com "serverless-cluster-tenant-2" deleted
```
Set the Pulumi configuration variables to destroy the shared storage TiDB cluster.
```
$ pulumi config set --path 'pulumi-shared-storage-tidb:serverless-keyspaces[0].externalIP' false
$ pulumi config set --path 'pulumi-shared-storage-tidb:serverless-keyspaces[1].externalIP' false
$ pulumi config set --path 'pulumi-shared-storage-tidb:serverless-keyspaces[0].rootPassword' ""
$ pulumi config set --path 'pulumi-shared-storage-tidb:serverless-keyspaces[1].rootPassword' ""
$ pulumi config set pulumi-shared-storage-tidb:serverless-enabled false
```
Destroy the shared storage TiDB cluster by running `pulumi up`.
```
$ pulumi up
Updating (dev-us-east-1-f01)

     Type                                                   Name                                               Status            
     pulumi:pulumi:Stack                                    pulumi-shared-storage-tidb-dev-us-east-1-f01                         
     ├─ eks:index:Cluster                                   dev-us-east-1-f01-cluster                                            
 -   ├─ kubernetes:yaml:ConfigFile                          dev-us-east-1-f01-serverless-initializer-tenant-1  deleted           
 -   ├─ kubernetes:yaml:ConfigFile                          dev-us-east-1-f01-serverless-initializer-tenant-2  deleted           
 -   ├─ kubernetes:yaml:ConfigFile                          dev-us-east-1-f01-serverless-cluster-tenant-1      deleted           
 -   ├─ kubernetes:core/v1:Secret                           dev-us-east-1-f01-serverless-secret-tenant-1       deleted (2s)      
 -   ├─ kubernetes:yaml:ConfigFile                          dev-us-east-1-f01-serverless-cluster-tenant-2      deleted           
 -   ├─ kubernetes:yaml:ConfigFile                          dev-us-east-1-f01-serverless-cluster               deleted           
 -   ├─ kubernetes:core/v1:Secret                           dev-us-east-1-f01-serverless-secret-tenant-2       deleted (3s)      
 -   └─ kubernetes:core/v1:Namespace                        dev-us-east-1-f01-serverless-ns                    deleted (15s)     

Outputs:
    kubeconfig   : { ... }

Resources:
    - 13 deleted
    125 unchanged

Duration: 1m9s
```

### Destroying Control Plane
Set the Pulumi configuration variables to destroy the control plane resources.
```
$ pulumi config set pulumi-shared-storage-tidb:control-plane-enabled false
```
Destroy the control plane resources by running `pulumi up`.
```
$ pulumi up
Updating (dev-us-east-1-f01)

     Type                                                               Name                                          Status              
     pulumi:pulumi:Stack                                                pulumi-shared-storage-tidb-dev-us-east-1-f01                      
     ├─ eks:index:Cluster                                               dev-us-east-1-f01-cluster                                         
 -   ├─ kubernetes:storage.k8s.io/v1:StorageClass                       ebs-sc                                        deleted (2s)        
 -   ├─ kubernetes:helm.sh/v3:Chart                                     aws-ebs-csi-driver                            deleted             
 -   ├─ kubernetes:helm.sh/v3:Chart                                     aws-cluster-auto-scaler                       deleted             
 -   ├─ kubernetes:yaml:ConfigFile                                      tidb-operator-crds                            deleted             
 -   └─ kubernetes:helm.sh/v3:Release                                   tidb-operator                                 deleted (19s)       

Outputs:
    kubeconfig   : { ... }

Resources:
    - 42 deleted
    83 unchanged

Duration: 1m46s
```
### Tidying up EKS Cluster
Destroy all of its infrastructure with `pulumi destroy`.
```
$ pulumi destroy
Destroying (dev-us-east-1-f01)

     Type                                    Name                                                         Status             
 -   pulumi:pulumi:Stack                     pulumi-shared-storage-tidb-dev-us-east-1-f01                 deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1c-tikv-standard-0                 deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-default-standard-0                         deleted            
 -   ├─ aws:iam:Role                         dev-us-east-1-f01-managed-nodegroup-role                     deleted (1s)       
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1a-pd-standard-0                   deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1c-pd-standard-0                   deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-tidb-standard-0                            deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1b-tikv-standard-0                 deleted            
 -   ├─ awsx:x:ec2:Vpc                       dev-us-east-1-f01-vpc                                        deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1b-pd-standard-0                   deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1a-tikv-standard-0                 deleted            
 -   └─ eks:index:Cluster                    dev-us-east-1-f01-cluster                                    deleted            

Outputs:
    kubeconfig   : { ... }

Resources:
    - 83 deleted

Duration: 7m56s
```
The resources in the stack have been deleted, but the history and configuration associated with the stack are still maintained.
If you want to remove the stack completely, run `pulumi stack rm dev-us-east-1-f01`.
```
pulumi stack rm dev-us-east-1-f01
```

## License
This package is licensed under a MIT license (Copyright (c) 2023 Meng Huang)

## Author
pulumi-shared-storage-tidb was written by Meng Huang.
