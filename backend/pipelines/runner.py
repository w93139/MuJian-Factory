import logging

from error_messages import safe_error_text
from job_limits import job_limiter

from . import action_transfer, digital_human, standard
from .storage import mark_completed, mark_failed, mark_running, update_task

logger = logging.getLogger(__name__)

PIPELINE_REGISTRY = {
    "standard": standard.run,
    "quick_create": standard.run,
    "action_transfer": action_transfer.run,
    "digital_human": digital_human.run,
}


async def run_pipeline_task(task_id: str, pipeline: str, params: dict, job_token: str | None = None) -> None:
    try:
        runner = PIPELINE_REGISTRY[pipeline]
        logger.info("Pipeline task started: task_id=%s pipeline=%s", task_id, pipeline)
        mark_running(task_id)
        output, artifacts = await runner(task_id, params)
        mark_completed(task_id, output=output, artifacts=artifacts)
        logger.info(
            "Pipeline task completed: task_id=%s pipeline=%s artifacts=%d",
            task_id,
            pipeline,
            len(artifacts or []),
        )
    except Exception as exc:
        reason = safe_error_text(exc)
        logger.error("Pipeline task failed: task_id=%s pipeline=%s reason=%s", task_id, pipeline, reason)
        update_task(task_id, progress=0)
        mark_failed(task_id, reason)
    finally:
        if job_token:
            job_limiter.release(job_token)
