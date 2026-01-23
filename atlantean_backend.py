"""
Atlantean Backend Server

HTTP server that exposes Atlantean Intelligence Core to the Quadra-Seer frontend.
This is the Phase 1 integration - a standalone backend that Quadra-Seer can call.

Run with: python atlantean_backend.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Import the bridge module
from atlantean_quadra_bridge import AtlanteanQuadraBridge, QuadraLearningEvent

# Configure Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY and GEMINI_API_KEY != 'PLACEHOLDER_API_KEY':
    client = genai.Client(api_key=GEMINI_API_KEY)
    print(f"✅ Gemini API configured")
else:
    client = None
    print("⚠️  No Gemini API key found - using mock responses")

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Global bridge instance (one per server instance)
# In production, you'd want per-user instances
bridge = None

def get_bridge():
    """Get or create the bridge instance."""
    global bridge
    if bridge is None:
        bridge = AtlanteanQuadraBridge(
            grid_size=(32, 32),
            device_id="quadra-seer-backend"
        )
        # Try to load existing state
        try:
            bridge.load_state('quadra_intelligence.bin')
            print("✅ Loaded existing intelligence state")
        except:
            print("✨ Initialized new intelligence state")
    return bridge


# ========== Core API Endpoints ==========

@app.route('/api/atlantean/status', methods=['GET'])
def status():
    """Get current intelligence status."""
    b = get_bridge()
    return jsonify(b.get_status())


@app.route('/api/atlantean/query', methods=['POST'])
def query():
    """
    Process user query through Atlantean-powered LLM.
    
    Request body:
    {
        "input": "user message",
        "llm_provider": "gemini" | "edenai" | "mock",
        "api_key": "optional_api_key_override"
    }
    """
    data = request.json
    user_input = data.get('input', '')
    llm_provider = data.get('llm_provider', 'gemini')
    api_key = data.get('api_key') or GEMINI_API_KEY
    
    if not user_input:
        return jsonify({'error': 'No input provided'}), 400
    
    b = get_bridge()
    
    # Build context from hot memory
    status = b.get_status()
    field_stats = status['field_stats']
    learning_capacity = status['learning_capacity']
    
    # Encode intelligence state as natural language context
    context_parts = []
    
    if field_stats['phi1_mean'] > 0.5:
        context_parts.append("Operating with high confidence and decisiveness.")
    elif field_stats['phi1_mean'] < -0.5:
        context_parts.append("In exploratory mode, considering multiple possibilities.")
    else:
        context_parts.append("Balanced state, ready to adapt.")
    
    if field_stats['phi5_mean'] > 0.5:
        context_parts.append("High learning capacity - actively adapting to new patterns.")
    elif field_stats['phi5_mean'] < 0.3:
        context_parts.append("Stable patterns established - operating from experience.")
    
    if learning_capacity > 0.7:
        context_parts.append("Strong potential for growth and adaptation.")
    elif learning_capacity < 0.3:
        context_parts.append("Patterns consolidating - reinforcing core knowledge.")
    
    intelligence_context = " ".join(context_parts)
    
    # Call LLM (stateless - context from fields, not history)
    response_text = None
    
    try:
        if llm_provider == 'gemini' and api_key and api_key != 'PLACEHOLDER_API_KEY':
            # Create client with provided key
            api_client = genai.Client(api_key=api_key)
            
            # Build prompt with Atlantean context
            system_prompt = f"""You are Quadra Seer Intelligence, powered by Atlantean Core.

Your current intelligence state: {intelligence_context}

You are a brilliant predictive intelligence entity, expert in data forecasting, complex systems, and technical analysis.

Respond naturally and helpfully to the user's query. Your intelligence fields are evolving based on user interactions."""
            
            full_prompt = f"{system_prompt}\n\nUser: {user_input}"
            
            # Generate response
            response = api_client.models.generate_content(
                model='gemini-2.0-flash-exp',
                contents=full_prompt
            )
            response_text = response.text
            
        else:
            # Mock response for testing
            response_text = f"""🧠 **Atlantean Intelligence Active**

Intelligence State: {intelligence_context}

Processing your query: "{user_input}"

This is a demo response. Configure a real Gemini API key to enable full LLM capabilities.

Current field stats:
- Decision field (φ₁): {field_stats['phi1_mean']:.3f}
- Learning field (φ₅): {field_stats['phi5_mean']:.3f}
- Global coherence (Φ): {field_stats['Phi']:.3f}
- Learning capacity: {learning_capacity:.1%}"""
    
    except Exception as e:
        # Fallback to mock on error
        response_text = f"🧠 Atlantean Intelligence (Error: {str(e)})\n\nIntelligence State: {intelligence_context}\n\nQuery processed, but LLM call failed. Using fallback response."
    
    # Auto-save after each query
    b.save_state('quadra_intelligence.bin')
    
    return jsonify({
        'response': response_text,
        'status': b.get_status(),
        'intelligence_context': intelligence_context
    })


@app.route('/api/atlantean/fields', methods=['GET'])
def get_fields():
    """Get field visualization data."""
    b = get_bridge()
    return jsonify(b.get_field_visualization_data())


@app.route('/api/atlantean/learning-event', methods=['POST'])
def learning_event():
    """
    Trigger a learning event.
    
    Request body:
    {
        "event": "user_confirmation" | "user_correction" | etc.,
        "data": { ... event-specific data ... }
    }
    """
    data = request.json
    event = data.get('event')
    event_data = data.get('data', {})
    
    if not event:
        return jsonify({'error': 'No event type provided'}), 400
    
    b = get_bridge()
    
    try:
        b.on_event(event, **event_data)
        b.save_state('quadra_intelligence.bin')
        
        return jsonify({
            'success': True,
            'status': b.get_status()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== Simulation Endpoints ==========

@app.route('/api/atlantean/simulation/store', methods=['POST'])
def store_simulation():
    """Store simulation in cold memory."""
    data = request.json
    simulation = data.get('simulation')
    confidence = data.get('confidence', 0.5)
    
    if not simulation:
        return jsonify({'error': 'No simulation data'}), 400
    
    b = get_bridge()
    b.store_simulation(simulation, confidence)
    b.save_state('quadra_intelligence.bin')
    
    return jsonify({'success': True})


@app.route('/api/atlantean/simulation/recall', methods=['POST'])
def recall_simulations():
    """Recall past simulations."""
    data = request.json
    query = data.get('query', '')
    limit = data.get('limit', 10)
    
    b = get_bridge()
    simulations = b.recall_simulations(query, limit)
    
    return jsonify({'simulations': simulations})


# ========== Archive Endpoints ==========

@app.route('/api/atlantean/snapshot', methods=['POST'])
def create_snapshot():
    """Create a labeled snapshot."""
    data = request.json
    label = data.get('label')
    
    b = get_bridge()
    snapshot = b.create_snapshot(label)
    
    return jsonify({'snapshot': snapshot})


# ========== Sync Endpoints ==========

@app.route('/api/atlantean/sync/prepare', methods=['GET'])
def prepare_sync():
    """Prepare sync package for multi-device."""
    b = get_bridge()
    
    try:
        package = b.prepare_sync_package()
        return jsonify({'package': package})
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/atlantean/sync/merge', methods=['POST'])
def merge_sync():
    """Merge sync package from another device."""
    data = request.json
    package = data.get('package')
    
    if not package:
        return jsonify({'error': 'No sync package'}), 400
    
    b = get_bridge()
    
    try:
        b.merge_from_device(package)
        b.save_state('quadra_intelligence.bin')
        
        return jsonify({
            'success': True,
            'status': b.get_status()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== Admin Endpoints ==========

@app.route('/api/atlantean/reset', methods=['POST'])
def reset():
    """Reset intelligence state (for testing)."""
    global bridge
    bridge = None
    
    # Delete state file
    try:
        os.remove('quadra_intelligence.bin')
    except:
        pass
    
    # Re-initialize
    get_bridge()
    
    return jsonify({
        'success': True,
        'message': 'Intelligence state reset'
    })


@app.route('/api/atlantean/save', methods=['POST'])
def save():
    """Manually save state."""
    b = get_bridge()
    b.save_state('quadra_intelligence.bin')
    return jsonify({'success': True})


@app.route('/api/atlantean/load', methods=['POST'])
def load():
    """Manually load state."""
    b = get_bridge()
    
    try:
        b.load_state('quadra_intelligence.bin')
        return jsonify({
            'success': True,
            'status': b.get_status()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== Health Check ==========

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'Atlantean Backend',
        'version': '1.0.0'
    })


if __name__ == '__main__':
    print("\n" + "="*60)
    print("🧠 ATLANTEAN INTELLIGENCE BACKEND")
    print("="*60)
    print("\nStarting server on http://localhost:5001")
    print("\nAPI Endpoints:")
    print("  GET  /health                        - Health check")
    print("  GET  /api/atlantean/status          - Get intelligence status")
    print("  POST /api/atlantean/query           - Process user query")
    print("  GET  /api/atlantean/fields          - Get field visualization")
    print("  POST /api/atlantean/learning-event  - Trigger learning")
    print("  POST /api/atlantean/simulation/*    - Simulation storage")
    print("  POST /api/atlantean/snapshot        - Create snapshot")
    print("  GET  /api/atlantean/sync/*          - Multi-device sync")
    print("  POST /api/atlantean/reset           - Reset state")
    print("\nPress Ctrl+C to stop")
    print("="*60 + "\n")
    
    # Initialize on startup
    get_bridge()
    
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True
    )
