# AI Triage Mode — Documentation

## Overview

The AI Triage Mode automatically classifies patient urgency based on detected gestures, emotional state, and clinical patterns. This is a high-impact feature that turns Sign-to-Health AI into a digital triage nurse.

## Urgency Levels

| Level | Emoji | Color | Description |
|-------|-------|-------|-------------|
| Immediate | 🚨 | Red (#ef4444) | Life-threatening, requires instant attention |
| Emergency | 🚑 | Orange (#f97316) | Urgent medical condition |
| Urgent | ⚠️ | Yellow (#eab308) | Needs prompt assessment |
| Non-urgent | 🟡 | Green (#22c55e) | Can wait, routine care |
| Mental Health | 🧠 | Purple (#a855f7) | Psychiatric/psychological needs |

## Pattern Matching

### Priority 1: Immediate

**Fall/Collapse**
- Tokens: `fallen`, `collapse`, `fall`, `critical`, `prone_position`
- Output: 🚨 Immediate
- Department: Emergency - Trauma

**Stroke Gestures**
- Tokens: `stroke`, `help`, `emergency`
- Output: 🚨 Immediate
- Department: Emergency - Neurology

### Priority 2: Emergency

**Chest Pain + Fear**
- Tokens: `point_chest`, `chest`
- Condition: `distress > 60%`
- Output: 🚑 Emergency
- Department: Emergency - Cardiology

**Breathing Difficulty**
- Tokens: `breathing`
- Condition: `distress > 50%` or clinical text contains "urgency: high"
- Output: 🚑 Emergency
- Department: Emergency - Respiratory

### Priority 3: Urgent

**Acute Abdominal Pain**
- Tokens: `point_lower_right`
- Condition: `painLevel > 50%`
- Output: ⚠️ Urgent
- Department: Emergency - Surgery (appendicitis concern)

**General Abdominal Pain**
- Tokens: `point_abdomen`, `abdomen`, `stomach`, `point_lower_left`
- Output: ⚠️ Urgent
- Department: Gastroenterology

### Priority 4: Non-urgent

**Migraine / Headache**
- Tokens: `point_head`, `point_temple`, `head` + `pain`
- Output: 🟡 Non-urgent
- Department: Neurology / General Medicine

### Priority 5: Mental Health

**Anxiety / Panic Attack**
- Tokens: `breathing` (without respiratory indicators)
- Condition: `emotion = anxious` and `distress > 50%`
- Output: 🧠 Mental Health
- Department: Psychiatry

## Implementation

### triageLogic.ts

```typescript
export function inferTriageUrgency(
  gestureState: GestureState | null,
  clinicalInterpretation: string | null
): TriageUrgency

export function getMatchedTriagePattern(
  gestureState: GestureState | null
): TriagePattern | null
```

### Triage Pattern Interface

```typescript
interface TriagePattern {
  id: string;
  name: string;
  tokens: string[];
  emotionThreshold?: { 
    painLevel?: number; 
    distress?: number; 
  };
  urgency: TriageUrgency;
  department: string;
}
```

### Defined Patterns

| ID | Name | Tokens | Urgency |
|----|------|--------|---------|
| stroke | Stroke Gestures | stroke, help | immediate |
| collapse | Fall / Collapse | fallen, collapse, fall, critical | immediate |
| chest_distress | Chest Pain + Fear | point_chest, chest | emergency |
| breathing | Breathing Difficulty | breathing | emergency |
| migraine | Migraine / Headache | point_head, point_temple, head | non-urgent |
| anxiety | Anxiety / Panic Attack | breathing + anxious emotion | mental-health |
| abdominal_acute | Acute Abdominal Pain | point_lower_right | urgent |
| abdominal_general | Abdominal Discomfort | point_abdomen, stomach | urgent |

## Knowledge Graph Integration

The triage system feeds into the explainability layer:

```
gesture → symptom → diagnosis → urgency → department
```

Example chain:
```
point_lower_right + pain → Lower right abdomen pain → 
Possible appendicitis → ⚠️ Urgent → Emergency Surgery
```

## UI Display

### TriageBadge Component

Displays urgency with:
- Emoji indicator
- Color-coded background
- Animated pulse for immediate/emergency

### ExplainabilityPanel

Shows matched pattern in the reasoning chain:
- Pattern name
- Urgency level
- Department recommendation

## Clinical Text Fallback

If no pattern matches, checks clinical interpretation text:
- Contains "emergency" or "critical" → emergency
- Contains "urgency: high" → emergency
- Contains "urgent" → urgent

## Testing Triage

Use demo buttons in CameraCapture:
- "Emergency (Collapse)" → immediate triage
- "Chest pain" → with distress triggers emergency
- "Headache" → non-urgent
- "Abdominal pain" → urgent

## Future Enhancements

1. **Machine Learning**: Train classifier on real triage data
2. **Vital Signs Integration**: Heart rate, SpO2 from wearables
3. **EHR Integration**: Pull patient history for context
4. **Multi-language**: Support for different sign languages
5. **Confidence Scoring**: Show triage confidence percentage
