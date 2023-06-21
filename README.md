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
 +   pulumi:pulumi:Stack                     pulumi-shared-storage-tidb-dev-us-east-1-f01                 created (788s) 
 +   ├─ awsx:x:ec2:Vpc                       dev-us-east-1-f01-vpc                                        created (2s)  
 +   ├─ eks:index:Cluster                    dev-us-east-1-f01-cluster                                    created (784s)      
 +   ├─ aws:iam:Role                         dev-us-east-1-f01-managed-nodegroup-role                     created (2s)        
 +   ├─ aws:iam:InstanceProfile              dev-us-east-1-f01-instance-profile                           created (2s)        
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-default-standard-0                         created (7s)        
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-tidb-standard-0                            created (9s)        
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1a-pd-standard-0                   created (6s)        
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1b-pd-standard-0                   created (10s)       
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1c-pd-standard-0                   created (8s)        
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1a-tikv-standard-0                 created (10s)       
 +   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1b-tikv-standard-0                 created (3s)        
 +   └─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-us-east-1c-tikv-standard-0                 created (9s)        

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

Duration: 15m54s
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

$ kubectl get nodes -l serverless.tidbcloud.com/node=default
NAME                          STATUS   ROLES    AGE     VERSION
ip-10-0-148-79.ec2.internal   Ready    <none>   5m5s    v1.26.4-eks-0a21954
ip-10-0-254-64.ec2.internal   Ready    <none>   4m35s   v1.26.4-eks-0a21954

$ kubectl get nodes -l serverless.tidbcloud.com/node=pd
NAME                           STATUS   ROLES    AGE     VERSION
ip-10-0-202-131.ec2.internal   Ready    <none>   4m46s   v1.26.4-eks-0a21954
ip-10-0-230-80.ec2.internal    Ready    <none>   4m49s   v1.26.4-eks-0a21954
ip-10-0-60-40.ec2.internal     Ready    <none>   4m51s   v1.26.4-eks-0a21954

$ kubectl get nodes -l serverless.tidbcloud.com/node=tikv
NAME                         STATUS   ROLES    AGE     VERSION
ip-10-0-119-4.ec2.internal   Ready    <none>   5m44s   v1.26.4-eks-0a21954
ip-10-0-3-111.ec2.internal   Ready    <none>   5m50s   v1.26.4-eks-0a21954
ip-10-0-88-95.ec2.internal   Ready    <none>   5m40s   v1.26.4-eks-0a21954

$ kubectl get nodes -l serverless.tidbcloud.com/node=tidb
NAME                          STATUS   ROLES    AGE     VERSION
ip-10-0-0-246.ec2.internal    Ready    <none>   5m41s   v1.26.4-eks-0a21954
ip-10-0-217-91.ec2.internal   Ready    <none>   5m26s   v1.26.4-eks-0a21954

$ kubectl -n kube-system get po -o wide
NAME                       READY   STATUS    RESTARTS   AGE     IP             NODE                           NOMINATED NODE   READINESS GATES
aws-node-5hwvz             1/1     Running   0          6m51s   10.0.88.95     ip-10-0-88-95.ec2.internal     <none>           <none>
aws-node-6g9xl             1/1     Running   0          6m22s   10.0.60.40     ip-10-0-60-40.ec2.internal     <none>           <none>
aws-node-btc8j             1/1     Running   0          6m20s   10.0.230.80    ip-10-0-230-80.ec2.internal    <none>           <none>
aws-node-c7pdr             1/1     Running   0          6m17s   10.0.202.131   ip-10-0-202-131.ec2.internal   <none>           <none>
aws-node-mmbmt             1/1     Running   0          6m29s   10.0.254.64    ip-10-0-254-64.ec2.internal    <none>           <none>
aws-node-pm5l2             1/1     Running   0          6m59s   10.0.148.79    ip-10-0-148-79.ec2.internal    <none>           <none>
aws-node-rkd2w             1/1     Running   0          6m37s   10.0.0.246     ip-10-0-0-246.ec2.internal     <none>           <none>
aws-node-rq2d7             1/1     Running   0          6m22s   10.0.217.91    ip-10-0-217-91.ec2.internal    <none>           <none>
aws-node-vr969             1/1     Running   0          7m1s    10.0.3.111     ip-10-0-3-111.ec2.internal     <none>           <none>
aws-node-xw8ln             1/1     Running   0          6m55s   10.0.119.4     ip-10-0-119-4.ec2.internal     <none>           <none>
coredns-55fb5d545d-bgfmj   1/1     Running   0          12m     10.0.159.221   ip-10-0-148-79.ec2.internal    <none>           <none>
coredns-55fb5d545d-n4nm9   1/1     Running   0          12m     10.0.166.99    ip-10-0-148-79.ec2.internal    <none>           <none>
kube-proxy-4477m           1/1     Running   0          6m51s   10.0.88.95     ip-10-0-88-95.ec2.internal     <none>           <none>
kube-proxy-4b29v           1/1     Running   0          7m1s    10.0.3.111     ip-10-0-3-111.ec2.internal     <none>           <none>
kube-proxy-72r4w           1/1     Running   0          6m55s   10.0.119.4     ip-10-0-119-4.ec2.internal     <none>           <none>
kube-proxy-c6znr           1/1     Running   0          6m22s   10.0.60.40     ip-10-0-60-40.ec2.internal     <none>           <none>
kube-proxy-cdqvq           1/1     Running   0          6m20s   10.0.230.80    ip-10-0-230-80.ec2.internal    <none>           <none>
kube-proxy-rvj2s           1/1     Running   0          6m37s   10.0.0.246     ip-10-0-0-246.ec2.internal     <none>           <none>
kube-proxy-v7glw           1/1     Running   0          6m17s   10.0.202.131   ip-10-0-202-131.ec2.internal   <none>           <none>
kube-proxy-vqf6n           1/1     Running   0          6m22s   10.0.217.91    ip-10-0-217-91.ec2.internal    <none>           <none>
kube-proxy-wjgnc           1/1     Running   0          6m59s   10.0.148.79    ip-10-0-148-79.ec2.internal    <none>           <none>
kube-proxy-zv7tq           1/1     Running   0          6m29s   10.0.254.64    ip-10-0-254-64.ec2.internal    <none>           <none>
```
### Deploying Control Plane
Set the Pulumi configuration variables for the control plane.
```
$ pulumi config set pulumi-shared-storage-tidb:cluster-autoscaler-enabled true
$ pulumi config set pulumi-shared-storage-tidb:csi-driver-enabled true
$ pulumi config set pulumi-shared-storage-tidb:tidb-operator-enabled true
```
Deploy the control plane components by running `pulumi up`.
```
$ pulumi up
Updating (dev-us-east-1-f01)

     Type                                                               Name                                          Status              
     pulumi:pulumi:Stack                                                pulumi-shared-storage-tidb-dev-us-east-1-f01                      
     ├─ eks:index:Cluster                                               dev-us-east-1-f01-cluster                                         
 +   ├─ kubernetes:helm.sh/v3:Chart                                     aws-cluster-auto-scaler                       created (0.88s)     
 +   ├─ kubernetes:helm.sh/v3:Chart                                     aws-ebs-csi-driver                            created (1s)        
 +   ├─ kubernetes:storage.k8s.io/v1:StorageClass                       ebs-sc                                        created (0.88s)     
 +   ├─ kubernetes:yaml:ConfigFile                                      tidb-operator-crds                            created (1s)        
 +   └─ kubernetes:helm.sh/v3:Release                                   tidb-operator                                 created (37s)       

Outputs:
    kubeconfig   : { ... }

Resources:
    + 42 created
    62 unchanged

Duration: 1m29s
```
The update takes ~2 minutes and will create the following resources on AWS:
* An Cluster Autoscaler for node group.
* An EBS CSI Driver and an EBS StorageClass.
* An TiDB Operator.

Confirm that the control plane components are running, run the following command.
```
$ kubectl -n kube-system get po -o wide
NAME                                       READY   STATUS    RESTARTS   AGE     IP             NODE                           NOMINATED NODE   READINESS GATES
cluster-autoscaler-6d9499f467-dcrhn        1/1     Running   0          9m43s   10.0.162.0     ip-10-0-148-79.ec2.internal    <none>           <none>
cluster-autoscaler-6d9499f467-tv6x5        1/1     Running   0          9m43s   10.0.196.240   ip-10-0-254-64.ec2.internal    <none>           <none>
ebs-csi-controller-78dc48fd5-4wvpd         5/5     Running   0          9m39s   10.0.254.164   ip-10-0-254-64.ec2.internal    <none>           <none>
ebs-csi-controller-78dc48fd5-kxbp9         5/5     Running   0          9m39s   10.0.151.58    ip-10-0-148-79.ec2.internal    <none>           <none>
ebs-csi-node-6jbxp                         3/3     Running   0          9m39s   10.0.15.0      ip-10-0-60-40.ec2.internal     <none>           <none>
ebs-csi-node-ddl8z                         3/3     Running   0          9m39s   10.0.64.65     ip-10-0-119-4.ec2.internal     <none>           <none>
ebs-csi-node-dpfmb                         3/3     Running   0          9m39s   10.0.37.138    ip-10-0-3-111.ec2.internal     <none>           <none>
ebs-csi-node-dxds4                         3/3     Running   0          9m39s   10.0.7.122     ip-10-0-0-246.ec2.internal     <none>           <none>
ebs-csi-node-f5ppb                         3/3     Running   0          9m39s   10.0.214.110   ip-10-0-254-64.ec2.internal    <none>           <none>
ebs-csi-node-fbdmd                         3/3     Running   0          9m39s   10.0.111.171   ip-10-0-88-95.ec2.internal     <none>           <none>
ebs-csi-node-fpgfd                         3/3     Running   0          9m39s   10.0.236.243   ip-10-0-217-91.ec2.internal    <none>           <none>
ebs-csi-node-g7cj2                         3/3     Running   0          9m39s   10.0.241.149   ip-10-0-202-131.ec2.internal   <none>           <none>
ebs-csi-node-mgvbl                         3/3     Running   0          9m39s   10.0.233.240   ip-10-0-230-80.ec2.internal    <none>           <none>
ebs-csi-node-pb228                         3/3     Running   0          9m39s   10.0.174.169   ip-10-0-148-79.ec2.internal    <none>           <none>
tidb-controller-manager-6ff7d8fb84-q82mz   1/1     Running   0          8m49s   10.0.248.170   ip-10-0-254-64.ec2.internal    <none>           <none>
tidb-scheduler-58d9f8d69-wf2vb             2/2     Running   0          8m49s   10.0.201.124   ip-10-0-254-64.ec2.internal    <none>           <none>
... other pods ...
```
Verify the `gp3` EBS StorageClass is ready.
```
$ kubectl -n kube-system get sc
NAME            PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
ebs-sc          ebs.csi.aws.com         Delete          WaitForFirstConsumer   true                   10m

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

     Type                                               Name                                           Status           
     pulumi:pulumi:Stack                                pulumi-shared-storage-tidb-dev-us-east-1-f01                    
     ├─ eks:index:Cluster                               dev-us-east-1-f01-cluster                                       
 +   ├─ kubernetes:core/v1:Namespace                    dev-us-east-1-f01-serverless-ns                created (1s)     
 +   ├─ kubernetes:yaml:ConfigFile                      dev-us-east-1-f01-serverless-cluster-tenant-1  created (2s)     
 +   ├─ kubernetes:yaml:ConfigFile                      dev-us-east-1-f01-serverless-cluster           created (4s)     
 +   └─ kubernetes:yaml:ConfigFile                      dev-us-east-1-f01-serverless-cluster-tenant-2  created (4s)     

Outputs:
    kubeconfig   : { ... }

Resources:
    + 7 created
    104 unchanged

Duration: 47s
```
The update takes ~1 minutes and will create the following resources on AWS:
* A tidb-serverless namespace.
* A shared PD cluster.
* A shared TiKV Cluster.
* An TiDB cluster as GC workers.
* Two tenant TiDB cluster.

View the Namespace status.
```
$ kubectl get ns                                                               
NAME              STATUS   AGE
default           Active   26m
kube-node-lease   Active   26m
kube-public       Active   26m
kube-system       Active   26m
tidb-serverless   Active   12m
```
View the Pod status in the tidb-serverless namespace.
```
$ kubectl -n tidb-serverless get po -o wide -l app.kubernetes.io/component=pd
NAME                      READY   STATUS    RESTARTS   AGE    IP            NODE                           NOMINATED NODE   READINESS GATES
serverless-cluster-pd-0   1/1     Running   0          8m3s   10.0.216.44   ip-10-0-230-80.ec2.internal    <none>           <none>
serverless-cluster-pd-1   1/1     Running   0          8m3s   10.0.23.224   ip-10-0-60-40.ec2.internal     <none>           <none>
serverless-cluster-pd-2   1/1     Running   0          8m3s   10.0.203.51   ip-10-0-202-131.ec2.internal   <none>           <none>

$ kubectl -n tidb-serverless get po -o wide -l app.kubernetes.io/component=tikv
NAME                        READY   STATUS    RESTARTS   AGE   IP            NODE                         NOMINATED NODE   READINESS GATES
serverless-cluster-tikv-0   1/1     Running   0          7m    10.0.90.139   ip-10-0-88-95.ec2.internal   <none>           <none>
serverless-cluster-tikv-1   1/1     Running   0          7m    10.0.41.35    ip-10-0-3-111.ec2.internal   <none>           <none>
serverless-cluster-tikv-2   1/1     Running   0          7m    10.0.65.81    ip-10-0-119-4.ec2.internal   <none>           <none>

$ kubectl -n tidb-serverless get po -o wide -l app.kubernetes.io/component=tidb
NAME                                 READY   STATUS    RESTARTS   AGE     IP             NODE                          NOMINATED NODE   READINESS GATES
serverless-cluster-tidb-0            2/2     Running   0          6m42s   10.0.225.192   ip-10-0-254-64.ec2.internal   <none>           <none>
serverless-cluster-tenant-1-tidb-0   2/2     Running   0          8m19s   10.0.223.170   ip-10-0-217-91.ec2.internal   <none>           <none>
serverless-cluster-tenant-2-tidb-0   2/2     Running   0          8m19s   10.0.55.52     ip-10-0-0-246.ec2.internal    <none>           <none>
```

### Use `kubectl port-forward` to access tenant TiDB service.
* Get a list of TiDB services in the tidb-serverless namespace.
```
$ kubectl -n tidb-serverless get svc -l app.kubernetes.io/component=tidb
NAME                                    TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)              AGE
serverless-cluster-tenant-1-tidb        ClusterIP   172.20.37.232   <none>        4000/TCP,10080/TCP   11m
serverless-cluster-tenant-1-tidb-peer   ClusterIP   None            <none>        10080/TCP            11m
serverless-cluster-tenant-2-tidb        ClusterIP   172.20.196.78   <none>        4000/TCP,10080/TCP   11m
serverless-cluster-tenant-2-tidb-peer   ClusterIP   None            <none>        10080/TCP            11m
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

### Expose tenant TiDB service over the internet(Optional).
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
     ├─ kubernetes:yaml:ConfigFile                      dev-us-east-1-f01-serverless-cluster-tenant-1                   
 ~   │  └─ kubernetes:pingcap.com/v1alpha1:TidbCluster  tidb-serverless/serverless-cluster-tenant-1    updated (1s)     [diff: ~spec]
     └─ kubernetes:yaml:ConfigFile                      dev-us-east-1-f01-serverless-cluster-tenant-2                   
 ~      └─ kubernetes:pingcap.com/v1alpha1:TidbCluster  tidb-serverless/serverless-cluster-tenant-2    updated (2s)     [diff: ~spec]

Outputs:
    kubeconfig   : { ... }

Resources:
    ~ 2 updated
    115 unchanged

Duration: 41s
```
* Get a list of TiDB services in the tidb-serverless namespace.
```
$  kubectl -n tidb-serverless get svc -l app.kubernetes.io/component=tidb | grep -v "<none>"
NAME                                    TYPE           CLUSTER-IP       EXTERNAL-IP                                                               PORT(S)                          AGE
serverless-cluster-tenant-1-tidb        LoadBalancer   172.20.89.2      a1c8454fb86394982b9db853fb80a9db-1883777515.us-east-1.elb.amazonaws.com   4000:32585/TCP,10080:31425/TCP   11m
serverless-cluster-tenant-2-tidb        LoadBalancer   172.20.44.158    ab039dc44805a43e3bb1daeb939e07d3-1382204841.us-east-1.elb.amazonaws.com   4000:32472/TCP,10080:32490/TCP   11m
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
serverless-cluster            True    pingcap/pd:v7.1.0   10Gi      3       3        pingcap/tikv:v7.1.0   10Gi      3       3        pingcap/tidb:v7.1.0   1       1        24m
serverless-cluster-tenant-1   True                                                                                                    pingcap/tidb:v7.1.0   1       1        24m
serverless-cluster-tenant-2   True                                                                                                    pingcap/tidb:v7.1.0   1       1        24m
```
* Delete these `tc`.
```
$ kubectl -n tidb-serverless delete tc --all
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

     Type                                               Name                                           Status            
     pulumi:pulumi:Stack                                pulumi-shared-storage-tidb-dev-us-east-1-f01                     
     ├─ eks:index:Cluster                               dev-us-east-1-f01-cluster                                        
 -   ├─ kubernetes:yaml:ConfigFile                      dev-us-east-1-f01-serverless-cluster           deleted           
 -   ├─ kubernetes:yaml:ConfigFile                      dev-us-east-1-f01-serverless-cluster-tenant-2  deleted           
 -   ├─ kubernetes:yaml:ConfigFile                      dev-us-east-1-f01-serverless-cluster-tenant-1  deleted           
 -   └─ kubernetes:core/v1:Namespace                    dev-us-east-1-f01-serverless-ns                deleted (13s)     

Outputs:
    kubeconfig   : { ... }

Resources:
    - 7 deleted
    104 unchanged

Duration: 51s
```

### Destroying Control Plane
Set the Pulumi configuration variables to destroy the control plane resources.
```
$ pulumi config set pulumi-shared-storage-tidb:cluster-autoscaler-enabled false
$ pulumi config set pulumi-shared-storage-tidb:csi-driver-enabled false
$ pulumi config set pulumi-shared-storage-tidb:tidb-operator-enabled false
```
Destroy the control plane resources by running `pulumi up`.
```
$ pulumi up
Updating (dev-us-east-1-f01)

     Type                                                               Name                                          Status              
     pulumi:pulumi:Stack                                                pulumi-shared-storage-tidb-dev-us-east-1-f01                      
     ├─ eks:index:Cluster                                               dev-us-east-1-f01-cluster                                         
 -   ├─ kubernetes:yaml:ConfigFile                                      tidb-operator-crds                            deleted             
 -   ├─ kubernetes:helm.sh/v3:Release                                   tidb-operator                                 deleted (31s)       
 -   ├─ kubernetes:storage.k8s.io/v1:StorageClass                       ebs-sc                                        deleted (1s)        
 -   ├─ kubernetes:helm.sh/v3:Chart                                     aws-cluster-auto-scaler                       deleted             
 -   └─ kubernetes:helm.sh/v3:Chart                                     aws-ebs-csi-driver                            deleted             

Outputs:
    kubeconfig   : { ... }

Resources:
    - 42 deleted
    62 unchanged

Duration: 1m44s
```
### Tidying up EKS Cluster
Destroy all of its infrastructure with `pulumi destroy`.
```
$ pulumi destroy
Destroying (dev-us-east-1-f01)

     Type                                    Name                                                         Status             
 -   pulumi:pulumi:Stack                     pulumi-shared-storage-tidb-dev-us-east-1-f01                 deleted            
 -   ├─ awsx:x:ec2:Vpc                       dev-us-east-1-f01-vpc                                        deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-pd-standard-0                              deleted            
 -   ├─ aws:iam:Role                         dev-us-east-1-f01-managed-nodegroup-role                     deleted (1s)       
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-tidb-standard-0                            deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-tikv-standard-0                            deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-us-east-1-f01-default-standard-0                         deleted            
 -   └─ eks:index:Cluster                    dev-us-east-1-f01-cluster                                    deleted            

Outputs:
    kubeconfig   : { ... }

Resources:
    - 62 deleted

Duration: 8m7s

The resources in the stack have been deleted, but the history and configuration associated with the stack are still maintained. 
If you want to remove the stack completely, run `pulumi stack rm dev-us-east-1-f01`.
```
Remove the stack completely
```
pulumi stack rm dev-us-east-1-f01
```

## License
This package is licensed under a MIT license (Copyright (c) 2023 Meng Huang)

## Author
pulumi-shared-storage-tidb was written by Meng Huang.
