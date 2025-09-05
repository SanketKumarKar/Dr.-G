import { APSAStateSnapshot, APSAHypothesis, APSASymptomEvidence, APSAQuestionPlan } from '../types';

/**
 * Lightweight client-side APSA engine.
 * Uses the Mayo dataset (loaded externally) to propose discriminating questions.
 * This is a heuristic / demonstrative implementation; real medical reasoning requires clinical validation.
 */
export class APSAEngine {
  private knowledge: Record<string, Set<string>> = {};// condition -> set(symptoms tokens)
  private state: APSAStateSnapshot = {
    cycle: 0,
    hypotheses: [],
    askedQuestions: [],
    evidence: [],
    terminated: false,
  };

  constructor(dataset: Array<{disease_name: string; symptoms: string;}>) {
    for (const row of dataset) {
      const tokens = new Set<string>();
      if (row.symptoms) {
        row.symptoms.split(/[.;\n]/).forEach(s => {
          const t = s.trim().toLowerCase();
            if (t.length > 2) tokens.add(t);
        });
      }
      this.knowledge[row.disease_name] = tokens;
    }
  }

  getSnapshot(): APSAStateSnapshot { return JSON.parse(JSON.stringify(this.state)); }

  addUserFreeText(text: string, messageIndex: number) {
    // naive symptom extraction: split by comma/; and pick phrases containing key words (pain, ache, fever, cough, dizzy, nausea, etc.)
    const candidates = text.toLowerCase().split(/[,;\n]/).map(t => t.trim()).filter(Boolean);
    const keywords = /(pain|ache|fever|cough|dizz|nausea|vomit|headache|fatigue|tired|sore|throat|rash|itch|swelling|cramp|diarrhea|constipation|shortness of breath|chest tight|palpitation)/;
    for (const c of candidates) {
      if (keywords.test(c) && !this.state.evidence.find(e => e.name === c)) {
        this.state.evidence.push({ name: c, presence: 'present', sourceMessageIndex: messageIndex });
      }
    }
    this.regenerateHypotheses();
  }

  answerQuestion(symptom: string, presence: 'present' | 'absent' | 'uncertain', messageIndex: number) {
    let ev = this.state.evidence.find(e => e.name === symptom);
    if (!ev) {
      ev = { name: symptom, presence, sourceMessageIndex: messageIndex };
      this.state.evidence.push(ev);
    } else {
      ev.presence = presence;
    }
    this.regenerateHypotheses();
  }

  private regenerateHypotheses() {
    // Score each condition by (#present in condition) - (#absent in condition) penalty
    const scores: {condition: string; score: number; supporting: string[]; contradicting: string[]}[] = [];
    for (const condition of Object.keys(this.knowledge)) {
      let score = 0; const supporting: string[] = []; const contradicting: string[] = [];
      for (const ev of this.state.evidence) {
        for (const token of this.knowledge[condition]) {
          if (token.includes(ev.name)) { // substring containment heuristic
            if (ev.presence === 'present') { score += 2; supporting.push(ev.name); }
            if (ev.presence === 'absent') { score -= 2; contradicting.push(ev.name); }
          }
        }
      }
      if (supporting.length) scores.push({ condition, score, supporting, contradicting });
    }
    // pick top 6
    scores.sort((a,b)=> b.score - a.score);
    const top = scores.slice(0,6);
    const min = Math.min(...top.map(t=>t.score), 0);
    const shifted = top.map(t => ({...t, score: t.score - min + 0.001}));
    const total = shifted.reduce((s,x)=> s + x.score, 0) || 1;
    this.state.hypotheses = shifted.map<APSAHypothesis>(t => ({ condition: t.condition, probability: t.score/total, supporting: t.supporting, contradicting: t.contradicting }));
  }

  proposeQuestion(): APSAQuestionPlan | null {
    if (this.state.hypotheses.length < 2) return null;
    // find candidate symptoms that appear in some hypotheses but not others
    const symptomFreq: Record<string, {inConditions: Set<string>; count: number}> = {};
    for (const h of this.state.hypotheses) {
      for (const token of this.knowledge[h.condition]) {
        if (!symptomFreq[token]) symptomFreq[token] = { inConditions: new Set(), count: 0 };
        symptomFreq[token].inConditions.add(h.condition); symptomFreq[token].count++;
      }
    }
    // ignore already asked/known evidence tokens
    const known = new Set(this.state.evidence.map(e => e.name));
    const candidates = Object.keys(symptomFreq).filter(k => !known.has(k) && /pain|fever|cough|headache|dizz|nausea|vomit|rash|swelling|diarrhea|shortness of breath|chest/.test(k));
    let best: {token: string; gain: number} | null = null;
    for (const token of candidates) {
      // compute naive information gain: probability splits if present vs absent
      let pPresent = 0;
      for (const h of this.state.hypotheses) {
        if (this.knowledge[h.condition].has(token)) pPresent += h.probability;
      }
      const pAbsent = 1 - pPresent;
      if (pPresent === 0 || pAbsent === 0) continue;
      const gain = -(pPresent*Math.log2(pPresent) + pAbsent*Math.log2(pAbsent));
      if (!best || gain > best.gain) best = { token, gain };
    }
    if (!best) return null;
    const question: APSAQuestionPlan = {
      question: `Have you experienced ${best.token}?`,
      targetSymptom: best.token,
      rationale: 'High information gain discriminating among leading hypotheses',
      expectedSplits: Object.fromEntries(this.state.hypotheses.map(h => [h.condition, h.probability]))
    };
    this.state.askedQuestions.push(question);
    return question;
  }

  /** Return frequently co-occurring symptom tokens with the provided symptom phrase */
  getCooccurring(symptom: string, limit = 6): string[] {
    const target = symptom.toLowerCase();
    const counter: Record<string, number> = {};
    for (const condition of Object.keys(this.knowledge)) {
      const tokens = this.knowledge[condition];
      // if any token contains the target phrase consider the whole condition's tokens
      if ([...tokens].some(t => t.includes(target))) {
        for (const t of tokens) {
          if (t.includes(target)) continue; // skip the original token
          if (t.length < 3) continue;
          counter[t] = (counter[t] || 0) + 1;
        }
      }
    }
    return Object.entries(counter)
      .sort((a,b)=> b[1]-a[1])
      .slice(0, limit)
      .map(([k]) => k);
  }
}

export default APSAEngine;
