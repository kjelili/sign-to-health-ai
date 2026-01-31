# Explainability Layer — Documentation

## Overview

The Explainability Layer provides AI transparency by visualizing the complete reasoning chain from gesture input to clinical recommendation. This builds clinician trust and ensures regulatory readiness.

## Knowledge Graph

The system displays a visual knowledge graph:

```
Gesture → Symptom → Diagnosis → Urgency → Department
```

### Nodes

| Node | Icon | Description |
|------|------|-------------|
| Gesture | ✋ Hand | Raw gesture tokens detected |
| Symptom | 📍 MapPin / ❤️ Heart | Pain location or emotion |
| Diagnosis | 🩺 Stethoscope | Clinical pattern matched |
| Urgency | ⚠️ AlertTriangle | Triage level assigned |
| Department | 🏥 Building | Recommended department |

### Visual Graph

The graph is rendered horizontally with arrows connecting each node:

```
[Gesture] → [Symptom] → [Diagnosis] → [Urgency] → [Department]
   ✋           📍          🩺           ⚠️           🏥
```

- Active nodes are highlighted with their assigned color
- Inactive nodes are grayed out
- Arrows indicate data flow direction

## Reasoning Steps

Below the graph, detailed steps are shown:

1. **Gestures Detected** - Raw tokens from hand/pose detection
2. **Pain Location** - Body region from gesture position
3. **Emotional State** - Pain level and distress percentage
4. **Pattern Matched** - Clinical pattern from triage rules
5. **Clinical Inference** - Full interpretation text
6. **Triage Level** - Urgency classification with emoji
7. **Recommended Dept** - Department routing

## Implementation

### ExplainabilityPanel.tsx

```typescript
interface Props {
  gestureState: GestureState | null;
  clinicalInterpretation: string | null;
}
```

### GraphNode Component

Each node in the knowledge graph:

```typescript
function GraphNode({
  icon: Icon,
  label: string,
  value: string,
  color: string,
  isActive: boolean,
})
```

### Data Sources

| Step | Source |
|------|--------|
| Gestures | `gestureState.gestureTokens` |
| Pain Location | `getPainRegionFromGestures()` |
| Emotion | `inferEmotionFromGestures()` |
| Pattern | `getMatchedTriagePattern()` |
| Clinical | `clinicalInterpretation` |
| Triage | `inferTriageUrgency()` |
| Department | `getDepartmentRecommendation()` |

## AI Transparency Notice

The panel includes a transparency notice:

> **AI Transparency:** This reasoning chain shows how Sign-to-Health AI 
> interprets gestures and arrives at clinical recommendations. All outputs 
> should be validated by qualified medical professionals.

## Benefits

### Clinician Trust
- Shows exactly how AI reached its conclusion
- Allows verification of each reasoning step
- No "black box" decisions

### Regulatory Readiness
- Full audit trail for each session
- Documented reasoning for medical records
- Compliance with AI transparency requirements

### Patient Understanding
- Visual representation is accessible
- Can be explained to patients
- Builds confidence in AI-assisted care

## Knowledge Graph Schema

### Entities

```typescript
type Entity = 
  | "gesture"      // Input from camera
  | "symptom"      // Pain/emotion detected
  | "diagnosis"    // Clinical pattern
  | "urgency"      // Triage level
  | "department";  // Routing destination
```

### Relationships

```typescript
type Relationship = 
  | "produces"     // gesture → symptom
  | "indicates"    // symptom → diagnosis
  | "requires"     // diagnosis → urgency
  | "routes_to";   // urgency → department
```

### Example Instance

```json
{
  "gesture": ["point_lower_right", "pain"],
  "produces": {
    "symptom": "Lower right abdomen pain"
  },
  "indicates": {
    "diagnosis": "Possible appendicitis"
  },
  "requires": {
    "urgency": "urgent"
  },
  "routes_to": {
    "department": "Emergency - Surgery"
  }
}
```

## Future Enhancements

### LangChain Integration
For production, integrate with LangChain for:
- Dynamic reasoning chains
- LLM-powered explanations
- Multi-step medical logic

### Neo4j Knowledge Graph
Store and query medical knowledge:
- Symptom → Disease relationships
- Treatment protocols
- Drug interactions

### Confidence Scores
Add confidence percentage to each step:
- Gesture recognition confidence
- Pattern match probability
- Diagnosis certainty

### Multi-language Support
Explain reasoning in patient's language:
- Translate explanation text
- Localized medical terms
- Cultural considerations
