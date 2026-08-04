import json
import boto3
import os
import logging
from typing import Dict, Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
bedrock_runtime = boto3.client('bedrock-runtime', region_name=os.environ.get('REGION', 'us-east-1'))
s3_client = boto3.client('s3')

# Flow configuration
FLOW_NAME = "${flow_name}"
FLOW_CONFIG = ${jsonencode(flow_config)}

def handler(event, context):
    """
    Main handler for ${flow_name} data automation flow.
    This is a template implementation that should be customized based on specific flow requirements.
    """
    try:
        logger.info(f"Starting {FLOW_NAME} flow execution")
        logger.info(f"Event: {json.dumps(event)}")
        
        operation = event.get('operation', 'execute')
        
        if operation == 'start':
            return start_flow(event, context)
        elif operation == 'execute':
            return execute_flow(event, context)
        elif operation == 'complete':
            return complete_flow(event, context)
        else:
            raise ValueError(f"Unknown operation: {operation}")
            
    except Exception as e:
        logger.error(f"Error in {FLOW_NAME} flow: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'flow_name': FLOW_NAME
            })
        }

def start_flow(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Initialize the flow execution."""
    logger.info(f"Initializing {FLOW_NAME} flow")
    
    # Extract input data
    input_data = event.get('input', {})
    
    # Validate input data
    if not validate_input(input_data):
        raise ValueError("Invalid input data")
    
    # Prepare flow execution context
    flow_context = {
        'flow_name': FLOW_NAME,
        'execution_id': context.aws_request_id,
        'start_time': context.get_remaining_time_in_millis(),
        'input_data': input_data,
        'status': 'initialized'
    }
    
    return {
        'statusCode': 200,
        'body': json.dumps(flow_context)
    }

def execute_flow(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Execute the main flow logic."""
    logger.info(f"Executing {FLOW_NAME} flow")
    
    input_data = event.get('input', {})
    results = {}
    
    # Example flow steps based on configuration
    %{ for step_name, step_config in flow_config.flow_steps ~}
    # Step: ${step_name}
    logger.info(f"Executing step: ${step_name}")
    results['${step_name}'] = execute_step_${replace(step_name, "-", "_")}(input_data, step_config)
    %{ endfor ~}
    
    # Process with foundation models if configured
    %{ for model in flow_config.foundation_models ~}
    if should_use_model('${model}', input_data):
        results['${replace(model, ".", "_")}'] = invoke_bedrock_model('${model}', input_data)
    %{ endfor ~}
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'flow_name': FLOW_NAME,
            'execution_id': context.aws_request_id,
            'results': results,
            'status': 'completed'
        })
    }

def complete_flow(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Complete the flow execution and cleanup."""
    logger.info(f"Completing {FLOW_NAME} flow")
    
    # Store results if configured
    if FLOW_CONFIG.get('store_results', False):
        store_results(event, context)
    
    # Send notifications if configured
    if FLOW_CONFIG.get('send_notifications', False):
        send_notifications(event, context)
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'flow_name': FLOW_NAME,
            'execution_id': context.aws_request_id,
            'status': 'completed',
            'message': f"{FLOW_NAME} flow completed successfully"
        })
    }

def validate_input(input_data: Dict[str, Any]) -> bool:
    """Validate input data based on flow configuration."""
    # TODO: Implement validation logic based on flow requirements
    return True

%{ for step_name, step_config in flow_config.flow_steps ~}
def execute_step_${replace(step_name, "-", "_")}(input_data: Dict[str, Any], step_config: Dict[str, Any]) -> Dict[str, Any]:
    """Execute ${step_name} step."""
    logger.info(f"Executing step: ${step_name}")
    
    # TODO: Implement step-specific logic
    # This is a placeholder implementation
    
    return {
        'step_name': '${step_name}',
        'status': 'completed',
        'output': f"Step ${step_name} completed successfully"
    }
%{ endfor ~}

def should_use_model(model_id: str, input_data: Dict[str, Any]) -> bool:
    """Determine if a specific model should be used based on input data."""
    # TODO: Implement model selection logic
    return True

def invoke_bedrock_model(model_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Invoke a Bedrock foundation model."""
    try:
        # Prepare model input based on model type
        if 'claude' in model_id.lower():
            body = json.dumps({
                "prompt": f"Human: {input_data.get('prompt', 'Process this data')}\\n\\nAssistant:",
                "max_tokens_to_sample": 1000,
                "temperature": 0.7,
                "stop_sequences": ["\\n\\nHuman:"]
            })
        elif 'titan' in model_id.lower():
            body = json.dumps({
                "inputText": input_data.get('prompt', 'Process this data'),
                "textGenerationConfig": {
                    "maxTokenCount": 1000,
                    "temperature": 0.7,
                    "stopSequences": []
                }
            })
        else:
            # Default format
            body = json.dumps({
                "prompt": input_data.get('prompt', 'Process this data'),
                "max_tokens": 1000,
                "temperature": 0.7
            })
        
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=body,
            contentType='application/json'
        )
        
        response_body = json.loads(response['body'].read())
        
        return {
            'model_id': model_id,
            'response': response_body,
            'status': 'success'
        }
        
    except Exception as e:
        logger.error(f"Error invoking model {model_id}: {str(e)}")
        return {
            'model_id': model_id,
            'error': str(e),
            'status': 'error'
        }

def store_results(event: Dict[str, Any], context: Any) -> None:
    """Store flow results to S3 or other storage."""
    # TODO: Implement result storage logic
    logger.info("Storing flow results")

def send_notifications(event: Dict[str, Any], context: Any) -> None:
    """Send notifications about flow completion."""
    # TODO: Implement notification logic
    logger.info("Sending flow completion notifications")
