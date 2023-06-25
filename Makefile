ENV ?= dev
REGION ?= us-east-1
SUFFIX ?= f01

.Phony: install init rm

default: install

install:
	npm install

init:
	cp config.yaml Pulumi.${ENV}-${REGION}-${SUFFIX}.yaml
	pulumi stack init ${ENV}-${REGION}-${SUFFIX}
	pulumi config set aws:region ${REGION}
	pulumi config set pulumi-shared-storage-tidb:cluster-env ${ENV}
	pulumi config set pulumi-shared-storage-tidb:cluster-region ${REGION}
	pulumi config set pulumi-shared-storage-tidb:cluster-suffix ${SUFFIX}

rm:
	pulumi stack rm ${ENV}-${REGION}-${SUFFIX}
