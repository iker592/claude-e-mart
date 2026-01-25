"""
Configuration module for Claude Agent SDK with multi-provider support.

Supports:
- Direct Anthropic API (default)
- AWS Bedrock
- Google Vertex AI

The provider is selected based on environment variables:
- CLAUDE_CODE_USE_BEDROCK=1 for AWS Bedrock
- CLAUDE_CODE_USE_VERTEX=1 for Google Vertex AI
- Neither set: uses direct Anthropic API
"""

import os
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class LLMProvider(Enum):
    """Available LLM providers for the Claude Agent SDK."""
    ANTHROPIC = "anthropic"
    BEDROCK = "bedrock"
    VERTEX = "vertex"


@dataclass
class BedrockConfig:
    """AWS Bedrock-specific configuration."""
    region: str
    model_id: Optional[str] = None
    endpoint_url: Optional[str] = None
    profile_name: Optional[str] = None

    # Default Claude model IDs available on Bedrock
    DEFAULT_MODEL_ID = "us.anthropic.claude-opus-4-20250514-v1:0"

    # Supported regions for Claude on Bedrock
    SUPPORTED_REGIONS = [
        "us-east-1",
        "us-west-2",
        "eu-west-1",
        "eu-central-1",
        "ap-northeast-1",
        "ap-southeast-2",
    ]


@dataclass
class VertexConfig:
    """Google Vertex AI-specific configuration."""
    project_id: str
    region: str


@dataclass
class AgentConfig:
    """Main configuration for the Claude Agent SDK."""
    provider: LLMProvider
    bedrock_config: Optional[BedrockConfig] = None
    vertex_config: Optional[VertexConfig] = None
    anthropic_api_key: Optional[str] = None


def get_provider() -> LLMProvider:
    """
    Determine which LLM provider to use based on environment variables.

    Returns:
        LLMProvider: The selected provider
    """
    if os.environ.get("CLAUDE_CODE_USE_BEDROCK") == "1":
        return LLMProvider.BEDROCK
    elif os.environ.get("CLAUDE_CODE_USE_VERTEX") == "1":
        return LLMProvider.VERTEX
    else:
        return LLMProvider.ANTHROPIC


def get_bedrock_config() -> BedrockConfig:
    """
    Get Bedrock configuration from environment variables.

    Returns:
        BedrockConfig: Bedrock-specific configuration

    Raises:
        ValueError: If required configuration is missing
    """
    region = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))

    if region not in BedrockConfig.SUPPORTED_REGIONS:
        logger.warning(
            f"AWS_REGION '{region}' may not support Claude on Bedrock. "
            f"Supported regions: {BedrockConfig.SUPPORTED_REGIONS}"
        )

    return BedrockConfig(
        region=region,
        model_id=os.environ.get("BEDROCK_MODEL_ID"),
        endpoint_url=os.environ.get("BEDROCK_ENDPOINT_URL"),
        profile_name=os.environ.get("AWS_PROFILE"),
    )


def get_vertex_config() -> VertexConfig:
    """
    Get Vertex AI configuration from environment variables.

    Returns:
        VertexConfig: Vertex AI-specific configuration

    Raises:
        ValueError: If required configuration is missing
    """
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise ValueError("GOOGLE_CLOUD_PROJECT environment variable is required for Vertex AI")

    region = os.environ.get("GOOGLE_CLOUD_REGION", "us-central1")

    return VertexConfig(
        project_id=project_id,
        region=region,
    )


def validate_bedrock_credentials() -> bool:
    """
    Validate that AWS credentials are available for Bedrock.

    Checks for credentials in this order:
    1. Explicit credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    2. AWS profile (AWS_PROFILE)
    3. Instance profile / IAM role (no env vars needed, boto3 handles this)

    Returns:
        bool: True if credentials appear to be configured
    """
    # Check for explicit credentials
    if os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY"):
        logger.info("Using explicit AWS credentials from environment variables")
        return True

    # Check for profile
    if os.environ.get("AWS_PROFILE"):
        logger.info(f"Using AWS profile: {os.environ.get('AWS_PROFILE')}")
        return True

    # Check if we might be running in AWS (EC2, Lambda, ECS)
    # In these environments, credentials come from instance metadata
    if os.environ.get("AWS_EXECUTION_ENV") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        logger.info("Running in AWS environment, using IAM role credentials")
        return True

    # Try to use default credential chain (might still work via ~/.aws/credentials)
    logger.info(
        "No explicit AWS credentials found. "
        "Will attempt to use default credential chain (IAM role, ~/.aws/credentials, etc.)"
    )
    return True


def load_config() -> AgentConfig:
    """
    Load and validate the complete agent configuration.

    Returns:
        AgentConfig: Complete configuration for the agent

    Raises:
        ValueError: If configuration is invalid or incomplete
    """
    provider = get_provider()

    config = AgentConfig(provider=provider)

    if provider == LLMProvider.BEDROCK:
        logger.info("Configuring Claude Agent SDK for AWS Bedrock")
        config.bedrock_config = get_bedrock_config()
        validate_bedrock_credentials()

    elif provider == LLMProvider.VERTEX:
        logger.info("Configuring Claude Agent SDK for Google Vertex AI")
        config.vertex_config = get_vertex_config()

    else:
        logger.info("Configuring Claude Agent SDK for direct Anthropic API")
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY environment variable is required for direct Anthropic API. "
                "Set CLAUDE_CODE_USE_BEDROCK=1 for Bedrock or CLAUDE_CODE_USE_VERTEX=1 for Vertex AI."
            )
        config.anthropic_api_key = api_key

    return config


def get_provider_info() -> dict:
    """
    Get information about the current provider configuration.

    Returns:
        dict: Provider information for health checks and debugging
    """
    provider = get_provider()
    info = {
        "provider": provider.value,
    }

    if provider == LLMProvider.BEDROCK:
        bedrock_config = get_bedrock_config()
        info.update({
            "aws_region": bedrock_config.region,
            "model_id": bedrock_config.model_id or BedrockConfig.DEFAULT_MODEL_ID,
            "credentials_source": _get_aws_credentials_source(),
        })
    elif provider == LLMProvider.VERTEX:
        try:
            vertex_config = get_vertex_config()
            info.update({
                "project_id": vertex_config.project_id,
                "region": vertex_config.region,
            })
        except ValueError as e:
            info["error"] = str(e)
    else:
        info["api_key_configured"] = bool(os.environ.get("ANTHROPIC_API_KEY"))

    return info


def _get_aws_credentials_source() -> str:
    """Determine the source of AWS credentials."""
    if os.environ.get("AWS_ACCESS_KEY_ID"):
        return "environment_variables"
    elif os.environ.get("AWS_PROFILE"):
        return f"profile:{os.environ.get('AWS_PROFILE')}"
    elif os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return "lambda_execution_role"
    elif os.environ.get("AWS_EXECUTION_ENV"):
        return "iam_role"
    else:
        return "default_credential_chain"
