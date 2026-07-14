import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { AgentOrchestrator } from "./orchestrator";
import { AgentResponse, AgentMessage } from "@aios/types";

// Define the State Interface
export interface WorkflowState {
  task: string;
  code_changes: string;
  reviewer_feedback: string;
  tester_feedback: string;
  status: "pending" | "coding" | "reviewing" | "testing" | "done" | "failed";
  iteration_count: number;
  final_response: AgentResponse | null;
}

// Define the channels for the state graph
const stateChannels = {
  task: {
    value: (x: string, y: string) => y ? y : x,
    default: () => ""
  },
  code_changes: {
    value: (x: string, y: string) => y ? y : x,
    default: () => ""
  },
  reviewer_feedback: {
    value: (x: string, y: string) => y ? y : x,
    default: () => ""
  },
  tester_feedback: {
    value: (x: string, y: string) => y ? y : x,
    default: () => ""
  },
  status: {
    value: (x: string, y: string) => y ? y : x,
    default: () => "pending"
  },
  iteration_count: {
    value: (x: number, y: number) => y, // simple override
    default: () => 0
  },
  final_response: {
    value: (x: AgentResponse | null, y: AgentResponse | null) => y ? y : x,
    default: () => null
  }
};

export class LangGraphWorkflows {
  private orchestrator: AgentOrchestrator;
  private checkpointer: MemorySaver;

  constructor(orchestrator: AgentOrchestrator) {
    this.orchestrator = orchestrator;
    this.checkpointer = new MemorySaver();
  }

  public getVerifyAndCorrectGraph() {
    const builder = new StateGraph<WorkflowState>({ channels: stateChannels as any })
      .addNode("coder", async (state: WorkflowState) => {
        let currentTask = state.task;
        if (state.tester_feedback) {
          currentTask = `The tester provided the following feedback on your previous output. Please fix the issues:\n\nTester Feedback:\n${state.tester_feedback}`;
        } else if (state.reviewer_feedback) {
          currentTask = `The reviewer provided the following feedback on your previous output. Please fix the issues:\n\nReviewer Feedback:\n${state.reviewer_feedback}`;
        }

        const response = await this.orchestrator.routeRequest("coder", { role: "user", content: currentTask, timestamp: Date.now() });
        return { 
          code_changes: response.message, 
          status: "coding", 
          iteration_count: state.iteration_count + 1,
          final_response: response
        };
      })
      .addNode("reviewer", async (state: WorkflowState) => {
        const reviewPrompt = `Please review the following code changes and output for the task: "${state.task}".\n\nCoder Output:\n${state.code_changes}\n\nIf it meets all requirements and quality standards, reply with exactly "APPROVED". Otherwise, provide actionable feedback for the coder to fix.`;
        const response = await this.orchestrator.routeRequest("reviewer", { role: "user", content: reviewPrompt, timestamp: Date.now() });
        
        const approved = response.message.trim().toUpperCase().includes("APPROVED");
        return { 
          reviewer_feedback: approved ? "" : response.message,
          status: approved ? "reviewing" : "failed"
        };
      })
      .addNode("tester", async (state: WorkflowState) => {
        const testPrompt = `Please test the following code changes and output for the task: "${state.task}".\n\nCoder Output:\n${state.code_changes}\n\nIf all tests pass and the code functions correctly, reply with exactly "PASS". Otherwise, provide actionable feedback for the coder to fix.`;
        const response = await this.orchestrator.routeRequest("tester", { role: "user", content: testPrompt, timestamp: Date.now() });
        
        const passed = response.message.trim().toUpperCase().includes("PASS");
        return { 
          tester_feedback: passed ? "" : response.message,
          status: passed ? "done" : "failed"
        };
      })
      
      // Edges
      .addEdge(START, "coder")
      .addEdge("coder", "reviewer")
      
      // Conditional edge from reviewer
      .addConditionalEdges("reviewer", (state: WorkflowState) => {
        if (state.status === "failed") {
          return state.iteration_count >= 3 ? END : "coder";
        }
        return "tester";
      })
      
      // Conditional edge from tester
      .addConditionalEdges("tester", (state: WorkflowState) => {
        if (state.status === "failed") {
          return state.iteration_count >= 3 ? END : "coder";
        }
        return END;
      });

    return builder.compile({ checkpointer: this.checkpointer });
  }

  // Debate Graph
  public getResolveDebateGraph() {
    interface DebateState {
      task: string;
      proposed_plan: string;
      architect_feedback?: string;
      security_feedback?: string;
      performance_feedback?: string;
      final_response?: AgentResponse;
    }

    const debateChannels = {
      task: null,
      proposed_plan: null,
      architect_feedback: null,
      security_feedback: null,
      performance_feedback: null,
      final_response: null
    };

    const builder = new StateGraph<DebateState>({ channels: debateChannels as any })
      .addNode("architect", async (state: DebateState) => {
        const debatePrompt = `Please evaluate the following proposed plan for the task: "${state.task}".\n\nProposed Plan:\n${state.proposed_plan}\n\nProvide your analysis, critique, and actionable improvements based on your specialized perspective.`;
        const res = await this.orchestrator.routeRequest('architect', { role: 'user', content: debatePrompt, timestamp: Date.now() });
        return { architect_feedback: res.message };
      })
      .addNode("security", async (state: DebateState) => {
        const debatePrompt = `Please evaluate the following proposed plan for the task: "${state.task}".\n\nProposed Plan:\n${state.proposed_plan}\n\nProvide your analysis, critique, and actionable improvements based on your specialized perspective.`;
        const res = await this.orchestrator.routeRequest('security', { role: 'user', content: debatePrompt, timestamp: Date.now() });
        return { security_feedback: res.message };
      })
      .addNode("performance", async (state: DebateState) => {
        const debatePrompt = `Please evaluate the following proposed plan for the task: "${state.task}".\n\nProposed Plan:\n${state.proposed_plan}\n\nProvide your analysis, critique, and actionable improvements based on your specialized perspective.`;
        const res = await this.orchestrator.routeRequest('performance', { role: 'user', content: debatePrompt, timestamp: Date.now() });
        return { performance_feedback: res.message };
      })
      .addNode("planner", async (state: DebateState) => {
        const synthesisPrompt = `You are a neutral orchestrator. A critical task was proposed:\n"${state.task}"\n\nProposed Plan:\n${state.proposed_plan}\n\nThe following expert analyses were provided:\n\nArchitect Feedback:\n${state.architect_feedback}\n\nSecurity Feedback:\n${state.security_feedback}\n\nPerformance Feedback:\n${state.performance_feedback}\n\nPlease synthesize these critiques and produce a 'Final Decision' summary that merges the best parts, resolves conflicts, and provides a final approved plan for execution. Start your output with "Final Decision:".`;
        const res = await this.orchestrator.routeRequest('planner', { role: 'user', content: synthesisPrompt, timestamp: Date.now() });
        return { final_response: res };
      })
      .addEdge(START, "architect")
      .addEdge(START, "security")
      .addEdge(START, "performance")
      .addEdge("architect", "planner")
      .addEdge("security", "planner")
      .addEdge("performance", "planner")
      .addEdge("planner", END);

    return builder.compile({ checkpointer: this.checkpointer });
  }
}
