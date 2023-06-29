ENV ?= dev
REGION ?= us-east-1
SUFFIX ?= f01

.Phony: install init clean

default: install

install:
	npm install

init:
	cp config.yaml Pulumi.${ENV}-${REGION}-${SUFFIX}.yaml
	pulumi stack init ${ENV}-${REGION}-${SUFFIX}
	pulumi config set aws:region ${REGION}
	pulumi config set cluster-env ${ENV}
	pulumi config set cluster-region ${REGION}
	pulumi config set cluster-suffix ${SUFFIX}

clean:
	pulumi stack rm ${ENV}-${REGION}-${SUFFIX}
