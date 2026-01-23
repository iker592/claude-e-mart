"""
Alternative Lambda handler using Mangum.

This is an alternative approach to Lambda Web Adapter.
To use Mangum instead of Lambda Web Adapter:
1. Set handler to 'lambda_handler.handler' in the CDK stack
2. Remove the Lambda Web Adapter layer
3. Remove AWS_LAMBDA_EXEC_WRAPPER environment variable

Usage:
    Lambda handler: lambda_handler.handler
"""

from mangum import Mangum
from server import app

# Create the Mangum handler
# lifespan="off" because Mangum handles ASGI lifespan differently
handler = Mangum(app, lifespan="off")
