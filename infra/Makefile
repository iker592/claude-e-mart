# CDK Deployment Makefile
# Usage: make deploy ENV=pr-6

ENV ?= dev

# Stack names
STORAGE_STACK = ClaudeEMartStorageStack$(if $(filter dev,$(ENV)),,-$(ENV))
API_STACK = ClaudeEMartApiStack$(if $(filter dev,$(ENV)),,-$(ENV))
UI_STACK = ClaudeEMartUiStack$(if $(filter dev,$(ENV)),,-$(ENV))

.PHONY: deploy destroy clean-failed

# Deploy all stacks in dependency order
deploy:
	@echo "Deploying environment: $(ENV)"
	cdk deploy $(STORAGE_STACK) --require-approval never -c envName=$(ENV)
	cdk deploy $(API_STACK) --require-approval never -c envName=$(ENV)
	cdk deploy $(UI_STACK) --require-approval never --outputs-file cdk-outputs.json -c envName=$(ENV)
	@echo "Deployment complete!"

# Destroy all stacks (reverse order)
destroy:
	@echo "Destroying environment: $(ENV)"
	cdk destroy $(UI_STACK) --force -c envName=$(ENV) || true
	cdk destroy $(API_STACK) --force -c envName=$(ENV) || true
	cdk destroy $(STORAGE_STACK) --force -c envName=$(ENV) || true
	@echo "Destroy complete!"

# Clean up failed stacks
clean-failed:
	@echo "Cleaning up failed stacks for: $(ENV)"
	@for stack in $(UI_STACK) $(API_STACK) $(STORAGE_STACK); do \
		STATUS=$$(aws cloudformation describe-stacks --stack-name $$stack --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND"); \
		if echo "$$STATUS" | grep -qE "(ROLLBACK|FAILED)"; then \
			echo "Deleting failed stack: $$stack (status: $$STATUS)"; \
			aws cloudformation delete-stack --stack-name $$stack; \
			aws cloudformation wait stack-delete-complete --stack-name $$stack || true; \
		fi; \
	done
	@echo "Cleanup complete!"
