"""
LangGraph workflow for parallel file processing with specialized agents
"""

from typing import Dict, Any, List
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.core.langgraph.state.parallel_processing_state import (
    ParallelProcessingState, 
    ProcessingStatus
)
from app.core.langgraph.nodes.parallel_processing_nodes import (
    initialize_parallel_processing_node,
    assign_agents_node,
    process_files_parallel_node,
    finalize_parallel_processing_node
)

class ParallelProcessingWorkflow:
    """
    LangGraph workflow for processing multiple files in parallel
    with specialized agents for different file types
    """
    
    def __init__(self):
        """Initialize the parallel processing workflow"""
        self.memory = MemorySaver()
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """
        Build the LangGraph workflow
        
        Returns:
            Configured StateGraph
        """
        # Create the state graph
        workflow = StateGraph(ParallelProcessingState)
        
        # Add nodes
        workflow.add_node("initialize", initialize_parallel_processing_node)
        workflow.add_node("assign_agents", assign_agents_node)
        workflow.add_node("process_parallel", process_files_parallel_node)
        workflow.add_node("finalize", finalize_parallel_processing_node)
        
        # Define the workflow edges
        workflow.set_entry_point("initialize")
        
        workflow.add_edge("initialize", "assign_agents")
        workflow.add_edge("assign_agents", "process_parallel")
        workflow.add_edge("process_parallel", "finalize")
        workflow.add_edge("finalize", END)
        
        # Compile the graph
        return workflow.compile(checkpointer=self.memory)
    
    async def process_files(
        self,
        files: List[Dict[str, Any]],
        extract_property_data: bool = True
    ) -> Dict[str, Any]:
        """
        Process multiple files in parallel using specialized agents
        
        Args:
            files: List of file data dictionaries with 'filename' and 'content' keys
            extract_property_data: Whether to extract property data from files
            
        Returns:
            Processing results
        """
        try:
            # Prepare initial state
            initial_state = {
                "files": files,
                "total_files": len(files),
                "extract_property_data": extract_property_data
            }
            
            # Run the workflow
            config = {"configurable": {"thread_id": f"parallel_processing_{id(files)}"}}
            final_state = await self.graph.ainvoke(initial_state, config=config)
            
            # Format results
            return self._format_results(final_state)
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Parallel processing workflow failed: {str(e)}",
                "total_files": len(files),
                "successful_uploads": 0,
                "failed_uploads": len(files),
                "total_documents_stored": 0,
                "processing_duration_seconds": 0,
                "results": []
            }
    
    def _format_results(self, state: ParallelProcessingState) -> Dict[str, Any]:
        """
        Format the workflow results
        
        Args:
            state: Final workflow state
            
        Returns:
            Formatted results
        """
        # Calculate success rate
        total_files = state["total_files"]
        successful_uploads = state["successful_uploads"]
        failed_uploads = state["failed_uploads"]
        success_rate = (successful_uploads / total_files * 100) if total_files > 0 else 0
        
        # Format completed tasks
        completed_results = []
        for task in state["completed_tasks"]:
            if task.result:
                completed_results.append({
                    "filename": task.filename,
                    "file_type": task.file_type,
                    "file_size": task.file_size,
                    "document_id": task.result.get("document_id"),
                    "agent_type": task.result.get("agent_type"),
                    "agent_name": task.result.get("agent_name"),
                    "processing_time_seconds": task.result.get("processing_time", 0),
                    "extracted_property_data": task.result.get("extracted_property_data"),
                    "success": True
                })
        
        # Format failed tasks
        failed_results = []
        for task in state["failed_tasks"]:
            failed_results.append({
                "filename": task.filename,
                "file_type": task.file_type,
                "file_size": task.file_size,
                "agent_type": task.agent_type.value,
                "error": task.error_message,
                "success": False
            })
        
        # Combine all results
        all_results = completed_results + failed_results
        
        # Create agent assignments mapping
        agent_assignments = {}
        for task in state["completed_tasks"]:
            if task.result and task.result.get("agent_type"):
                agent_assignments[task.filename] = task.result.get("agent_type")
        for task in state["failed_tasks"]:
            if task.agent_type:
                agent_assignments[task.filename] = task.agent_type.value
        
        return {
            "success": state["overall_status"] == ProcessingStatus.COMPLETED,
            "overall_status": state["overall_status"].value,
            "total_files": total_files,
            "successful_uploads": successful_uploads,
            "failed_uploads": failed_uploads,
            "success_rate_percent": round(success_rate, 2),
            "total_documents_stored": state["total_documents_stored"],
            "processing_duration_seconds": state.get("processing_duration_seconds", 0),
            "processing_start_time": state["processing_start_time"].isoformat(),
            "processing_end_time": state["processing_end_time"].isoformat() if state.get("processing_end_time") else None,
            "errors": state["errors"],
            "results": all_results,
            "agent_assignments": agent_assignments,
            "agent_statistics": self._calculate_agent_statistics(state),
            "performance_metrics": self._calculate_performance_metrics(state)
        }
    
    def _calculate_agent_statistics(self, state: ParallelProcessingState) -> Dict[str, Any]:
        """
        Calculate statistics for each agent type
        
        Args:
            state: Workflow state
            
        Returns:
            Agent statistics
        """
        agent_stats = {}
        
        # Count tasks by agent type
        for task in state["tasks"]:
            agent_type = task.agent_type.value
            if agent_type not in agent_stats:
                agent_stats[agent_type] = {
                    "total_tasks": 0,
                    "successful_tasks": 0,
                    "failed_tasks": 0,
                    "total_processing_time": 0,
                    "average_processing_time": 0
                }
            
            agent_stats[agent_type]["total_tasks"] += 1
            
            if task.status == ProcessingStatus.COMPLETED:
                agent_stats[agent_type]["successful_tasks"] += 1
                if task.result and "processing_time" in task.result:
                    agent_stats[agent_type]["total_processing_time"] += task.result["processing_time"]
            else:
                agent_stats[agent_type]["failed_tasks"] += 1
        
        # Calculate averages
        for agent_type, stats in agent_stats.items():
            if stats["successful_tasks"] > 0:
                stats["average_processing_time"] = round(
                    stats["total_processing_time"] / stats["successful_tasks"], 2
                )
            stats["success_rate"] = round(
                (stats["successful_tasks"] / stats["total_tasks"] * 100) if stats["total_tasks"] > 0 else 0, 2
            )
        
        return agent_stats
    
    def _calculate_performance_metrics(self, state: ParallelProcessingState) -> Dict[str, Any]:
        """
        Calculate performance metrics
        
        Args:
            state: Workflow state
            
        Returns:
            Performance metrics
        """
        total_files = state["total_files"]
        duration = state.get("processing_duration_seconds", 0)
        
        metrics = {
            "total_files_processed": total_files,
            "processing_duration_seconds": duration,
            "files_per_second": round(total_files / duration, 2) if duration > 0 else 0,
            "average_processing_time_per_file": round(duration / total_files, 2) if total_files > 0 else 0,
            "parallel_efficiency": self._calculate_parallel_efficiency(state),
            "agent_utilization": self._calculate_agent_utilization(state)
        }
        
        return metrics
    
    def _calculate_parallel_efficiency(self, state: ParallelProcessingState) -> float:
        """
        Calculate parallel processing efficiency
        
        Args:
            state: Workflow state
            
        Returns:
            Efficiency percentage
        """
        # This is a simplified calculation
        # In a real implementation, you'd compare against sequential processing time
        total_tasks = len(state["tasks"])
        if total_tasks <= 1:
            return 100.0
        
        # Estimate sequential time (sum of all individual processing times)
        sequential_time = 0
        for task in state["completed_tasks"]:
            if task.result and "processing_time" in task.result:
                sequential_time += task.result["processing_time"]
        
        # Actual parallel time
        parallel_time = state.get("processing_duration_seconds", 0)
        
        if parallel_time > 0 and sequential_time > 0:
            efficiency = (sequential_time / parallel_time) * 100
            return round(min(efficiency, 100.0), 2)
        
        return 0.0
    
    def _calculate_agent_utilization(self, state: ParallelProcessingState) -> Dict[str, float]:
        """
        Calculate agent utilization rates
        
        Args:
            state: Workflow state
            
        Returns:
            Agent utilization percentages
        """
        utilization = {}
        
        for agent_type, agent_list in state["available_agents"].items():
            total_agents = len(agent_list)
            if total_agents == 0:
                utilization[agent_type.value] = 0.0
                continue
            
            # Count how many agents were actually used
            used_agents = set()
            for task in state["tasks"]:
                if task.assigned_agent:
                    used_agents.add(task.assigned_agent)
            
            used_count = len([agent for agent in used_agents if agent.startswith(agent_type.value)])
            utilization[agent_type.value] = round((used_count / total_agents) * 100, 2)
        
        return utilization
