# pulumi-tidb-serverless
Deploy a shared storage TiDB cluster on AWS using pulumi.

## Getting started

### Prerequisites

* [Install Pulumi](https://www.pulumi.com/docs/install/)
* [Install Node.js](https://nodejs.org/en/download)
* Install a package manager for Node.js, such as [npm](https://www.npmjs.com/get-npm) or [Yarn](https://classic.yarnpkg.com/en/docs/install).
* [Configure AWS credentials](https://www.pulumi.com/registry/packages/aws/installation-configuration/)
* [Install AWS IAM Authenticator for Kubernetes](https://docs.aws.amazon.com/eks/latest/userguide/install-aws-iam-authenticator.html)

### Initializing the Pulumi Project
1. Start by cloning the [pulumi-tidb-serverless](https://github.com/hslam/pulumi-tidb-serverless) to your local machine.
```
$ git clone https://github.com/hslam/pulumi-tidb-serverless.git
$ cd pulumi-tidb-serverless
```
2. Install the dependencies.
```
$ make install
```
3. Set environment variables for a new Pulumi stack.
```
$ export ENV=dev
$ export REGION=ap-southeast-1
$ export SUFFIX=f01
```
4. Create an empty Pulumi stack named `${ENV}-${REGION}-${SUFFIX}`.
```
$ make init
```
5. Switch the current workspace to the Pulumi stack `${ENV}-${REGION}-${SUFFIX}`.
```
$ pulumi stack select ${ENV}-${REGION}-${SUFFIX}
```

### Provisioning a New EKS Cluster
Create the EKS cluster by running `pulumi up`.
```
$ pulumi up
Updating (dev-ap-southeast-1-f01)

     Type                                          Name                                                         Status              
 +   pulumi:pulumi:Stack                           pulumi-tidb-serverless-dev-ap-southeast-1-f01                 created (779s)      
 +   ├─ eks:index:Cluster                          dev-ap-southeast-1-f01-cluster                                    created (745s)      
 +   ├─ aws:iam:Role                               dev-ap-southeast-1-f01-managed-nodegroup-role                     created (3s)        
 +   ├─ awsx:ec2:Vpc                               dev-ap-southeast-1-f01-vpc                                        created (5s)        
 +   ├─ eks:index:ManagedNodeGroup                 dev-ap-southeast-1-f01-ap-southeast-1c-pd-standard-0                   created (3s)        
 +   ├─ eks:index:ManagedNodeGroup                 dev-ap-southeast-1-f01-ap-southeast-1a-tikv-standard-0                 created (6s)        
 +   ├─ eks:index:ManagedNodeGroup                 dev-ap-southeast-1-f01-ap-southeast-1b-tikv-standard-0                 created (6s)        
 +   ├─ eks:index:ManagedNodeGroup                 dev-ap-southeast-1-f01-ap-southeast-1b-pd-standard-0                   created (6s)        
 +   ├─ eks:index:ManagedNodeGroup                 dev-ap-southeast-1-f01-default-standard-0                         created (7s)        
 +   ├─ eks:index:ManagedNodeGroup                 dev-ap-southeast-1-f01-ap-southeast-1c-tikv-standard-0                 created (7s)        
 +   ├─ eks:index:ManagedNodeGroup                 dev-ap-southeast-1-f01-tidb-standard-0                            created (8s)        
 +   └─ eks:index:ManagedNodeGroup                 dev-ap-southeast-1-f01-ap-southeast-1a-pd-standard-0                   created (8s)        

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
    + 73 created

Duration: 17m19s
```
The update takes 15-20 minutes and will create the following resources on AWS:
- A VPC in the region, with public & private subnets across the region's 3 availability zones.
- The IAM Role for node group.
- An EKS cluster with v1.26 of Kubernetes.
- Create an ASG across multiple AZs for each component `default, tidb`.
- Create multiple ASGs for each component `pd, tikv` with one ASG per AZ.

Once the update is complete, verify the cluster, node groups, and Pods are up and running:
```
$ pulumi stack output kubeconfig > kubeconfig.yml && export KUBECONFIG=$PWD/kubeconfig.yml

$ kubectl get nodes -l serverless=default
NAME                          STATUS   ROLES    AGE     VERSION
ip-10-0-154-70.ec2.internal   Ready    <none>   2m12s   v1.26.4-eks-0a21954
ip-10-0-2-145.ec2.internal    Ready    <none>   2m39s   v1.26.4-eks-0a21954
ip-10-0-78-173.ec2.internal   Ready    <none>   2m17s   v1.26.4-eks-0a21954

$ kubectl get nodes -l serverless=pd
NAME                           STATUS   ROLES    AGE     VERSION
ip-10-0-10-58.ec2.internal     Ready    <none>   2m47s   v1.26.4-eks-0a21954
ip-10-0-149-139.ec2.internal   Ready    <none>   2m54s   v1.26.4-eks-0a21954
ip-10-0-76-229.ec2.internal    Ready    <none>   2m31s   v1.26.4-eks-0a21954

$ kubectl get nodes -l serverless=tikv
NAME                           STATUS   ROLES    AGE     VERSION
ip-10-0-144-174.ec2.internal   Ready    <none>   112s    v1.26.4-eks-0a21954
ip-10-0-16-248.ec2.internal    Ready    <none>   2m39s   v1.26.4-eks-0a21954
ip-10-0-81-0.ec2.internal      Ready    <none>   2m17s   v1.26.4-eks-0a21954

$ kubectl get nodes -l serverless=tidb
NAME                          STATUS   ROLES    AGE     VERSION
ip-10-0-150-46.ec2.internal   Ready    <none>   2m54s   v1.26.4-eks-0a21954
ip-10-0-26-233.ec2.internal   Ready    <none>   3m12s   v1.26.4-eks-0a21954


$ kubectl label --list nodes -l serverless=default | grep "topology.kubernetes.io/zone"
 topology.kubernetes.io/zone=ap-southeast-1c
 topology.kubernetes.io/zone=ap-southeast-1a
 topology.kubernetes.io/zone=ap-southeast-1b

$ kubectl label --list nodes -l serverless=pd | grep "topology.kubernetes.io/zone"
 topology.kubernetes.io/zone=ap-southeast-1a
 topology.kubernetes.io/zone=ap-southeast-1c
 topology.kubernetes.io/zone=ap-southeast-1b

$ kubectl label --list nodes -l serverless=tikv | grep "topology.kubernetes.io/zone"
 topology.kubernetes.io/zone=ap-southeast-1c
 topology.kubernetes.io/zone=ap-southeast-1a
 topology.kubernetes.io/zone=ap-southeast-1b

$ kubectl label --list nodes -l serverless=tidb | grep "topology.kubernetes.io/zone"
 topology.kubernetes.io/zone=ap-southeast-1c
 topology.kubernetes.io/zone=ap-southeast-1a


$ kubectl -n kube-system get po -o wide
NAME                       READY   STATUS    RESTARTS   AGE     IP             NODE                           NOMINATED NODE   READINESS GATES
aws-node-2t62m             1/1     Running   0          3m34s   10.0.154.70    ip-10-0-154-70.ec2.internal    <none>           <none>
aws-node-69sbp             1/1     Running   0          3m21s   10.0.81.0      ip-10-0-81-0.ec2.internal      <none>           <none>
aws-node-87xfd             1/1     Running   0          3m43s   10.0.16.248    ip-10-0-16-248.ec2.internal    <none>           <none>
aws-node-b699f             1/1     Running   0          3m49s   10.0.150.46    ip-10-0-150-46.ec2.internal    <none>           <none>
aws-node-bvs8d             1/1     Running   0          4m1s    10.0.2.145     ip-10-0-2-145.ec2.internal     <none>           <none>
aws-node-d4skr             1/1     Running   0          4m6s    10.0.149.139   ip-10-0-149-139.ec2.internal   <none>           <none>
aws-node-h2x5k             1/1     Running   0          2m56s   10.0.144.174   ip-10-0-144-174.ec2.internal   <none>           <none>
aws-node-rn9kw             1/1     Running   0          3m59s   10.0.10.58     ip-10-0-10-58.ec2.internal     <none>           <none>
aws-node-s6qlv             1/1     Running   0          3m43s   10.0.76.229    ip-10-0-76-229.ec2.internal    <none>           <none>
aws-node-sjfdp             1/1     Running   0          3m39s   10.0.78.173    ip-10-0-78-173.ec2.internal    <none>           <none>
aws-node-tmx9t             1/1     Running   0          4m6s    10.0.26.233    ip-10-0-26-233.ec2.internal    <none>           <none>
coredns-55fb5d545d-gcx9b   1/1     Running   0          9m10s   10.0.28.180    ip-10-0-2-145.ec2.internal     <none>           <none>
coredns-55fb5d545d-vl9pp   1/1     Running   0          9m10s   10.0.2.80      ip-10-0-2-145.ec2.internal     <none>           <none>
kube-proxy-2hxrl           1/1     Running   0          3m34s   10.0.154.70    ip-10-0-154-70.ec2.internal    <none>           <none>
kube-proxy-2vx45           1/1     Running   0          2m56s   10.0.144.174   ip-10-0-144-174.ec2.internal   <none>           <none>
kube-proxy-4rlkl           1/1     Running   0          4m6s    10.0.149.139   ip-10-0-149-139.ec2.internal   <none>           <none>
kube-proxy-9spd8           1/1     Running   0          3m43s   10.0.76.229    ip-10-0-76-229.ec2.internal    <none>           <none>
kube-proxy-dsxwl           1/1     Running   0          3m39s   10.0.78.173    ip-10-0-78-173.ec2.internal    <none>           <none>
kube-proxy-hndws           1/1     Running   0          3m59s   10.0.10.58     ip-10-0-10-58.ec2.internal     <none>           <none>
kube-proxy-rm7vw           1/1     Running   0          4m1s    10.0.2.145     ip-10-0-2-145.ec2.internal     <none>           <none>
kube-proxy-rqgvj           1/1     Running   0          3m43s   10.0.16.248    ip-10-0-16-248.ec2.internal    <none>           <none>
kube-proxy-sghcn           1/1     Running   0          4m6s    10.0.26.233    ip-10-0-26-233.ec2.internal    <none>           <none>
kube-proxy-sqdv4           1/1     Running   0          3m21s   10.0.81.0      ip-10-0-81-0.ec2.internal      <none>           <none>
kube-proxy-z6qht           1/1     Running   0          3m49s   10.0.150.46    ip-10-0-150-46.ec2.internal    <none>           <none>
```

### Deploying Control Plane
Set the Pulumi configuration variables for the control plane.
```
$ pulumi config set control-plane-enabled true
```
Deploy the control plane components by running `pulumi up`.
```
$ pulumi up
Updating (dev-ap-southeast-1-f01)

     Type                                                               Name                                          Status              
     pulumi:pulumi:Stack                                                pulumi-tidb-serverless-dev-ap-southeast-1-f01                      
     ├─ eks:index:Cluster                                               dev-ap-southeast-1-f01-cluster                                         
 +   ├─ kubernetes:yaml:ConfigFile                                      tidb-operator-crds                            created (2s)        
 +   ├─ kubernetes:helm.sh/v3:Chart                                     aws-cluster-auto-scaler                       created (2s)        
 +   ├─ kubernetes:helm.sh/v3:Release                                   aws-load-balancer-controller                  created (55s)       
 +   ├─ kubernetes:helm.sh/v3:Chart                                     aws-ebs-csi-driver                            created (3s)        
 +   ├─ kubernetes:helm.sh/v3:Release                                   tidb-operator                                 created (51s)       
 +   └─ kubernetes:storage.k8s.io/v1:StorageClass                       ebs-sc                                        created (3s)        

Outputs:
    kubeconfig   : { ... }

Resources:
    + 47 created
    73 unchanged

Duration: 1m3s
```
The update takes ~1 minutes and will create the following resources on AWS:
- A Cluster Autoscaler for node group.
- An AWS Load Balancer Controller for service.
- An EBS CSI Driver and an EBS StorageClass.
- TiDB Operator CRDs and an TiDB Operator.

Confirm that the control plane components are running, run the following command.
```
$ kubectl -n kube-system get po -o wide
NAME                                                     READY   STATUS    RESTARTS   AGE     IP             NODE                           NOMINATED NODE   READINESS GATES
aws-load-balancer-controller-e2ba6640-59d47ff8ff-4qsw9   1/1     Running   0          34s     10.0.89.142    ip-10-0-78-173.ec2.internal    <none>           <none>
aws-load-balancer-controller-e2ba6640-59d47ff8ff-lr7wt   1/1     Running   0          34s     10.0.28.29     ip-10-0-2-145.ec2.internal     <none>           <none>
cluster-autoscaler-6d9499f467-fs2xb                      1/1     Running   0          54s     10.0.131.31    ip-10-0-154-70.ec2.internal    <none>           <none>
cluster-autoscaler-6d9499f467-nmnxx                      1/1     Running   0          54s     10.0.91.107    ip-10-0-78-173.ec2.internal    <none>           <none>
ebs-csi-controller-78dc48fd5-p9pv8                       5/5     Running   0          56s     10.0.137.216   ip-10-0-154-70.ec2.internal    <none>           <none>
ebs-csi-controller-78dc48fd5-q59tc                       5/5     Running   0          57s     10.0.69.85     ip-10-0-78-173.ec2.internal    <none>           <none>
ebs-csi-node-2ndb7                                       3/3     Running   0          56s     10.0.133.130   ip-10-0-154-70.ec2.internal    <none>           <none>
ebs-csi-node-4hdlh                                       3/3     Running   0          56s     10.0.18.122    ip-10-0-16-248.ec2.internal    <none>           <none>
ebs-csi-node-5rvrc                                       3/3     Running   0          56s     10.0.130.34    ip-10-0-150-46.ec2.internal    <none>           <none>
ebs-csi-node-7gsr6                                       3/3     Running   0          56s     10.0.83.181    ip-10-0-76-229.ec2.internal    <none>           <none>
ebs-csi-node-cncq4                                       3/3     Running   0          56s     10.0.133.102   ip-10-0-149-139.ec2.internal   <none>           <none>
ebs-csi-node-fxs2j                                       3/3     Running   0          56s     10.0.153.17    ip-10-0-144-174.ec2.internal   <none>           <none>
ebs-csi-node-mgwsz                                       3/3     Running   0          56s     10.0.7.171     ip-10-0-2-145.ec2.internal     <none>           <none>
ebs-csi-node-n8x65                                       3/3     Running   0          56s     10.0.94.41     ip-10-0-78-173.ec2.internal    <none>           <none>
ebs-csi-node-p4bl7                                       3/3     Running   0          56s     10.0.10.196    ip-10-0-26-233.ec2.internal    <none>           <none>
ebs-csi-node-sffnj                                       3/3     Running   0          56s     10.0.1.216     ip-10-0-10-58.ec2.internal     <none>           <none>
ebs-csi-node-tmk9s                                       3/3     Running   0          56s     10.0.82.0      ip-10-0-81-0.ec2.internal      <none>           <none>
tidb-controller-manager-7cb7f9c956-j4g5q                 1/1     Running   0          43s     10.0.84.141    ip-10-0-78-173.ec2.internal    <none>           <none>
tidb-scheduler-59d5fdf9bd-57rsf                          2/2     Running   0          43s     10.0.158.86    ip-10-0-154-70.ec2.internal    <none>           <none>
... other pods ...
```
Verify the `gp3` EBS StorageClass is ready.
```
$ kubectl -n kube-system get sc
NAME            PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
ebs-sc          ebs.csi.aws.com         Delete          WaitForFirstConsumer   true                   97s

$ kubectl -n kube-system describe sc ebs-sc
Name:            ebs-sc
Provisioner:           ebs.csi.aws.com
Parameters:            fsType=ext4,iops=4000,throughput=400,type=gp3
AllowVolumeExpansion:  True
MountOptions:
  nodelalloc
  noatime
ReclaimPolicy:      Delete
VolumeBindingMode:  WaitForFirstConsumer
```

### Deploying Shared Storage TiDB Cluster
Set the Pulumi configuration variables for the shared storage TiDB cluster.
- (Optional) If you want to initialize the password when you start the tenant TiDB service for the first time, set the following variables. If you have already initialized the password, you do not need to repeat the initialization when you wake up the tenant TiDB service.
```
$ export PASSWORD_TENANT_1="admin-1"
$ export PASSWORD_TENANT_2="admin-2"
$ pulumi config set --path 'serverless-keyspaces[0].rootPassword' "${PASSWORD_TENANT_1}"
$ pulumi config set --path 'serverless-keyspaces[1].rootPassword' "${PASSWORD_TENANT_2}"
```
- Enable the shared storage TiDB cluster.
```
$ pulumi config set --path 'serverless-keyspaces[0].tidbReplicas' 1
$ pulumi config set --path 'serverless-keyspaces[1].tidbReplicas' 1
$ pulumi config set --path 'serverless-suspend' false
$ pulumi config set serverless-enabled true
```
Deploy the shared storage TiDB cluster by running `pulumi up`.
```
$ pulumi up
Updating (dev-ap-southeast-1-f01)

     Type                                                   Name                                               Status              
     pulumi:pulumi:Stack                                    pulumi-tidb-serverless-dev-ap-southeast-1-f01                           
     ├─ eks:index:Cluster                                   dev-ap-southeast-1-f01-cluster                                              
 +   ├─ kubernetes:core/v1:Namespace                        dev-ap-southeast-1-f01-serverless-ns                    created (0.77s)     
 +   ├─ kubernetes:yaml:ConfigFile                          dev-ap-southeast-1-f01-serverless-cluster-tenant-2      created (5s)        
 +   ├─ kubernetes:yaml:ConfigFile                          dev-ap-southeast-1-f01-serverless-cluster-tenant-1      created (9s)        
 +   ├─ kubernetes:yaml:ConfigFile                          dev-ap-southeast-1-f01-serverless-cluster               created (9s)        
 +   ├─ kubernetes:core/v1:Secret                           dev-ap-southeast-1-f01-serverless-secret-tenant-2       created (3s)        
 +   ├─ kubernetes:core/v1:Secret                           dev-ap-southeast-1-f01-serverless-secret-tenant-1       created (4s)        
 +   ├─ kubernetes:yaml:ConfigFile                          dev-ap-southeast-1-f01-serverless-initializer-tenant-2  created (2s)        
 +   └─ kubernetes:yaml:ConfigFile                          dev-ap-southeast-1-f01-serverless-initializer-tenant-1  created (4s)        

Outputs:
    kubeconfig   : { ... }

Resources:
    + 13 created
    120 unchanged

Duration: 56s
```
The update takes ~1 minutes and will create the following resources on AWS:
- A tidb-serverless namespace.
- A shared PD cluster.
- A shared TiKV cluster.
- An TiDB cluster as GC workers.
- Two tenant TiDB cluster.

View the Namespace status.
```
$ kubectl get ns
NAME              STATUS   AGE
default           Active   20m
kube-node-lease   Active   20m
kube-public       Active   20m
kube-system       Active   20m
tidb-serverless   Active   48s
```
View the Pod status in the tidb-serverless namespace.
```
$ kubectl -n tidb-serverless get po -o wide -l app.kubernetes.io/component=pd
NAME                      READY   STATUS    RESTARTS   AGE   IP             NODE                           NOMINATED NODE   READINESS GATES
serverless-cluster-pd-0   1/1     Running   0          57s   10.0.158.134   ip-10-0-149-139.ec2.internal   <none>           <none>
serverless-cluster-pd-1   1/1     Running   0          57s   10.0.69.99     ip-10-0-76-229.ec2.internal    <none>           <none>
serverless-cluster-pd-2   1/1     Running   0          57s   10.0.18.235    ip-10-0-10-58.ec2.internal     <none>           <none>

$ kubectl -n tidb-serverless get po -o wide -l app.kubernetes.io/component=tikv
NAME                        READY   STATUS    RESTARTS   AGE   IP             NODE                           NOMINATED NODE   READINESS GATES
serverless-cluster-tikv-0   1/1     Running   0          51s   10.0.19.50     ip-10-0-16-248.ec2.internal    <none>           <none>
serverless-cluster-tikv-1   1/1     Running   0          51s   10.0.131.185   ip-10-0-144-174.ec2.internal   <none>           <none>
serverless-cluster-tikv-2   1/1     Running   0          51s   10.0.85.193    ip-10-0-81-0.ec2.internal      <none>           <none>

$ kubectl -n tidb-serverless get po -o wide -l app.kubernetes.io/component=tidb
NAME                                 READY   STATUS    RESTARTS   AGE    IP             NODE                          NOMINATED NODE   READINESS GATES
serverless-cluster-tenant-1-tidb-0   2/2     Running   0          2m3s   10.0.150.108   ip-10-0-150-46.ec2.internal   <none>           <none>
serverless-cluster-tenant-2-tidb-0   2/2     Running   0          2m2s   10.0.20.77     ip-10-0-26-233.ec2.internal   <none>           <none>
serverless-cluster-tidb-0            2/2     Running   0          21s    10.0.7.203     ip-10-0-2-145.ec2.internal    <none>           <none>
```
Get tenant TiDB services in the tidb-serverless namespace.
```
$ kubectl -n tidb-serverless get svc -l app.kubernetes.io/component=tidb | grep LoadBalancer
serverless-cluster-tenant-1-tidb        LoadBalancer   172.20.175.51    k8s-tidbserv-serverle-2e56d1dxxx-892c265c2ab1exxx.elb.ap-southeast-1.amazonaws.com   4000:30429/TCP,10080:31032/TCP   2m26s
serverless-cluster-tenant-2-tidb        LoadBalancer   172.20.213.180   k8s-tidbserv-serverle-5b6b01axxx-36495fe2ad75dxxx.elb.ap-southeast-1.amazonaws.com   4000:31325/TCP,10080:30186/TCP   2m26s
```
You can select either `kubectl port-forward` or a bastion host from the following options to access the database.

### (Optional) Using `kubectl port-forward` to access the database
If you do not create a bastion host, you can use `kubectl port-forward` to access tenant TiDB service.

Forward tenant TiDB port from the local host to the k8s cluster.
```
$ kubectl port-forward -n tidb-serverless svc/serverless-cluster-tenant-1-tidb 14001:4000 > pf14001.out &
$ kubectl port-forward -n tidb-serverless svc/serverless-cluster-tenant-2-tidb 14002:4000 > pf14002.out &
```
Set environment variables for the tenant TiDB service.
```
$ export HOST_TENANT_1=127.0.0.1
$ export HOST_TENANT_2=127.0.0.1

$ export PORT_TENANT_1=14001
$ export PORT_TENANT_2=14002
```
Install the MySQL client on your local machine.

### (Optional) Preparing a bastion host to access the database
If you do not use `kubectl port-forward`, you can create a bastion host to access tenant TiDB service.

Allow the bastion host to access the Internet. Select the correct key pair so that you can log in to the host via SSH.

Generate an OpenSSH keypair for use with your server - as per the AWS [Requirements](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html#how-to-generate-your-own-key-and-import-it-to-aws).
```
$ ssh-keygen -t rsa -f rsa -m PEM
```
This will output two files, `rsa` and `rsa.pub`, in the current directory. Be sure not to commit these files!

We then need to configure our stack so that the public key is used by our EC2 instance, and the private key used
for subsequent SCP and SSH steps that will configure our server after it is stood up.
```
$ cat rsa.pub | pulumi config set bastion-public-key --
$ pulumi config set bastion-enabled true
```
From there, you can run `pulumi up` and all bastion resources will be provisioned and configured.
```
$ pulumi up
Updating (dev-ap-southeast-1-f01)

     Type                      Name                                          Status            
     pulumi:pulumi:Stack       pulumi-tidb-serverless-dev-ap-southeast-1-f01                    
 +   ├─ aws:ec2:KeyPair        dev-ap-southeast-1-f01-bastion-key-pair            created (2s)      
 +   ├─ aws:ec2:SecurityGroup  dev-ap-southeast-1-f01-bastion-security-group      created (6s)      
     ├─ eks:index:Cluster      dev-ap-southeast-1-f01-cluster                                       
 +   └─ aws:ec2:Instance       dev-ap-southeast-1-f01-bastion                     created (26s)     

Outputs:
  + bastionHost     : "50.16.xx.xx"
    kubeconfig      : { ... }

Resources:
    + 3 created
    133 unchanged

Duration: 1m3s
```
The update takes ~1 minutes and will create a bastion host on AWS.

You can ssh securely into your VPC.
```
$ ssh -i rsa ec2-user@$(pulumi stack output bastionHost)
```
Install the MySQL client on the bastion host.
```
$ sudo yum install mysql -y
```
Connect the client to the tenant TiDB cluster. If there is the tenant password, enter the password. Otherwise, press `Enter` directly.
```
$ mysql --comments -h ${tidb-nlb-dnsname} -P 4000 -u root -p
Enter password:
```
`${tidb-nlb-dnsname}` is the LoadBalancer domain name of the TiDB service. You can view the domain name in the EXTERNAL-IP field by executing `kubectl -n tidb-serverless get svc -l app.kubernetes.io/component=tidb | grep LoadBalancer` on local host.

Set environment variables on the bastion host.
```
$ export HOST_TENANT_1=k8s-tidbserv-serverle-2e56d1dxxx-892c265c2ab1exxx.elb.ap-southeast-1.amazonaws.com
$ export HOST_TENANT_2=k8s-tidbserv-serverle-5b6b01axxx-36495fe2ad75dxxx.elb.ap-southeast-1.amazonaws.com

$ export PORT_TENANT_1=4000
$ export PORT_TENANT_2=4000
```

### Accessing the database
Make sure you have operated one of the two access options above.

Access the tenant TiDB service and create a table in the test database.
```
$ mysql --comments -h ${HOST_TENANT_1} -P ${PORT_TENANT_1} -u root -p
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
Your MySQL connection id is 553
Server version: 5.7.25-TiDB-v7.1.0 TiDB Server (Apache License 2.0) Community Edition, MySQL 5.7 compatible

Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

MySQL [(none)]> use test;
Database changed
MySQL [test]> create table if not exists `tenant_1_tbl` (`id` int unsigned auto_increment primary key, `column_name` varchar(100));
Query OK, 0 rows affected (0.23 sec)

MySQL [test]> show tables;
+----------------+
| Tables_in_test |
+----------------+
| tenant_1_tbl   |
+----------------+
1 row in set (0.00 sec)

MySQL [test]> exit
Bye

$ mysql --comments -h ${HOST_TENANT_2} -P ${PORT_TENANT_2} -u root -p
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
Your MySQL connection id is 579
Server version: 5.7.25-TiDB-v7.1.0 TiDB Server (Apache License 2.0) Community Edition, MySQL 5.7 compatible

Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

MySQL [(none)]> use test;
Database changed
MySQL [test]> create table if not exists `tenant_2_tbl` (`id` int unsigned auto_increment primary key, `column_name` varchar(100));
Query OK, 0 rows affected (0.21 sec)

MySQL [test]> show tables;
+----------------+
| Tables_in_test |
+----------------+
| tenant_2_tbl   |
+----------------+
1 row in set (0.00 sec)

MySQL [test]> exit
Bye
```

### Suspending Shared Storage TiDB Cluster
If you are connecting to the bastion host, exit it and return to the previous local directory `pulumi-tidb-serverless` .
```
[ec2-user@ip-10-0-171-43 ~]$ exit
logout
Connection to 50.16.xx.xx closed.
```
Set the Pulumi configuration variables to suspend the shared storage TiDB cluster.
```
$ pulumi config set --path 'serverless-keyspaces[0].rootPassword' ""
$ pulumi config set --path 'serverless-keyspaces[1].rootPassword' ""
$ pulumi config set --path 'serverless-keyspaces[0].tidbReplicas' 0
$ pulumi config set --path 'serverless-keyspaces[1].tidbReplicas' 0
$ pulumi config set --path 'serverless-suspend' true
```
Suspend the shared storage TiDB cluster by running `pulumi up`.
```
$ pulumi up
Updating (dev-ap-southeast-1-f01)

     Type                                                   Name                                               Status              Info
     pulumi:pulumi:Stack                                    pulumi-tidb-serverless-dev-ap-southeast-1-f01                           
     ├─ eks:index:Cluster                                   dev-ap-southeast-1-f01-cluster                                              
     ├─ kubernetes:yaml:ConfigFile                          dev-ap-southeast-1-f01-serverless-cluster                                   
 ~   │  └─ kubernetes:pingcap.com/v1alpha1:TidbCluster      tidb-serverless/serverless-cluster                 updated (0.82s)     [diff: ~spec]
 -   ├─ kubernetes:yaml:ConfigFile                          dev-ap-southeast-1-f01-serverless-initializer-tenant-2  deleted             
 -   ├─ kubernetes:yaml:ConfigFile                          dev-ap-southeast-1-f01-serverless-initializer-tenant-1  deleted             
 -   ├─ kubernetes:core/v1:Secret                           dev-ap-southeast-1-f01-serverless-secret-tenant-2       deleted (3s)        
 -   ├─ kubernetes:yaml:ConfigFile                          dev-ap-southeast-1-f01-serverless-cluster-tenant-2      deleted             
 -   ├─ kubernetes:core/v1:Secret                           dev-ap-southeast-1-f01-serverless-secret-tenant-1       deleted (3s)        
 -   └─ kubernetes:yaml:ConfigFile                          dev-ap-southeast-1-f01-serverless-cluster-tenant-1      deleted             

Outputs:
    bastionHost     : "50.16.xx.xx"
    kubeconfig      : { ... }

Resources:
    ~ 1 updated
    - 10 deleted
    11 changes. 125 unchanged

Duration: 1m31s
```
After the shared storage TiDB cluster is suspended, all component pods of the cluster are deleted.

### Destroying Shared Storage TiDB Cluster
If you still have running kubectl processes that are forwarding ports, end them.
```
$ pgrep -lfa kubectl
10001 kubectl port-forward -n tidb-serverless svc/serverless-cluster-tenant-1-tidb 14001:4000
10002 kubectl port-forward -n tidb-serverless svc/serverless-cluster-tenant-2-tidb 14002:4000
$ kill 10001 10002
```
Set the Pulumi configuration variables to destroy the shared storage TiDB cluster.
```
$ pulumi config set serverless-enabled false
```
Destroy the shared storage TiDB cluster by running `pulumi up`.
```
$ pulumi up
Updating (dev-ap-southeast-1-f01)

     Type                                               Name                                          Status            
     pulumi:pulumi:Stack                                pulumi-tidb-serverless-dev-ap-southeast-1-f01                    
     ├─ eks:index:Cluster                               dev-ap-southeast-1-f01-cluster                                       
 -   ├─ kubernetes:yaml:ConfigFile                      dev-ap-southeast-1-f01-serverless-cluster          deleted           
 -   └─ kubernetes:core/v1:Namespace                    dev-ap-southeast-1-f01-serverless-ns               deleted (14s)     

Outputs:
    kubeconfig   : { ... }

Resources:
    - 3 deleted
    123 unchanged

Duration: 1m1s
```

### Destroying Control Plane
Set the Pulumi configuration variables to destroy the control plane resources.
```
$ pulumi config set bastion-enabled false
$ pulumi config set control-plane-enabled false
```
Destroy the control plane resources by running `pulumi up`.
```
$ pulumi up
Updating (dev-ap-southeast-1-f01)

     Type                                                               Name                                          Status              
     pulumi:pulumi:Stack                                                pulumi-tidb-serverless-dev-ap-southeast-1-f01                      
     ├─ eks:index:Cluster                                               dev-ap-southeast-1-f01-cluster                                         
 -   ├─ kubernetes:storage.k8s.io/v1:StorageClass                       ebs-sc                                        deleted (2s)        
 -   ├─ kubernetes:helm.sh/v3:Chart                                     aws-cluster-auto-scaler                       deleted             
 -   ├─ kubernetes:helm.sh/v3:Chart                                     aws-ebs-csi-driver                            deleted             
 -   ├─ kubernetes:helm.sh/v3:Release                                   aws-load-balancer-controller                  deleted (33s)       
 -   ├─ aws:ec2:Instance                                                dev-ap-southeast-1-f01-bastion                     deleted (39s)       
 -   ├─ kubernetes:helm.sh/v3:Release                                   tidb-operator                                 deleted (23s)       
 -   ├─ kubernetes:yaml:ConfigFile                                      tidb-operator-crds                            deleted             
 -   ├─ aws:ec2:KeyPair                                                 dev-ap-southeast-1-f01-bastion-key-pair            deleted (1s)        
 -   └─ aws:ec2:SecurityGroup                                           dev-ap-southeast-1-f01-bastion-security-group      deleted (4s)        

Outputs:
  - bastionHost     : "50.16.xx.xx"
    kubeconfig      : { ... }

Resources:
    - 50 deleted
    73 unchanged

Duration: 2m36s
```

### Tidying up EKS Cluster
Destroy all of its infrastructure with `pulumi destroy`.
```
$ pulumi destroy
Destroying (dev-ap-southeast-1-f01)

     Type                                    Name                                                         Status             
 -   pulumi:pulumi:Stack                     pulumi-tidb-serverless-dev-ap-southeast-1-f01                 deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-ap-southeast-1-f01-ap-southeast-1c-tikv-standard-0                 deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-ap-southeast-1-f01-default-standard-0                         deleted            
 -   ├─ aws:iam:Role                         dev-ap-southeast-1-f01-managed-nodegroup-role                     deleted (1s)       
 -   ├─ eks:index:ManagedNodeGroup           dev-ap-southeast-1-f01-ap-southeast-1a-pd-standard-0                   deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-ap-southeast-1-f01-ap-southeast-1c-pd-standard-0                   deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-ap-southeast-1-f01-tidb-standard-0                            deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-ap-southeast-1-f01-ap-southeast-1b-tikv-standard-0                 deleted            
 -   ├─ awsx:x:ec2:Vpc                       dev-ap-southeast-1-f01-vpc                                        deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-ap-southeast-1-f01-ap-southeast-1b-pd-standard-0                   deleted            
 -   ├─ eks:index:ManagedNodeGroup           dev-ap-southeast-1-f01-ap-southeast-1a-tikv-standard-0                 deleted            
 -   └─ eks:index:Cluster                    dev-ap-southeast-1-f01-cluster                                    deleted            

Outputs:
  - kubeconfig      : { ... }

Resources:
    - 73 deleted

Duration: 9m18s
```
The resources in the stack have been deleted, but the history and configuration associated with the stack are still maintained.
If you want to remove the stack completely, run `make clean` or `pulumi stack rm ${ENV}-${REGION}-${SUFFIX}`.
```
make clean
```

## License
This package is licensed under a MIT license (Copyright (c) 2023 Meng Huang)

## Author
pulumi-tidb-serverless was written by Meng Huang.
