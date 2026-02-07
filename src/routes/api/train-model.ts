import { APIEvent } from "@solidjs/start/server";
import {
  trainModel,
  loadModel,
  isModelAvailable,
} from "~/services/recommendation-model.server";
import {
  getPositiveFeedbackWithMetadata,
  getNegativeFeedbackWithMetadata,
} from "~/services/feedback.server";

/**
 * POST: Train the recommendation model on current positive/negative feedback.
 * GET: Return model status (available, trainedAt, sample counts).
 */
export async function POST(_event: APIEvent) {
  try {
    const result = await trainModel();
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to train model",
        message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET(_event: APIEvent) {
  try {
    const available = await isModelAvailable();
    const positive = await getPositiveFeedbackWithMetadata();
    const negative = await getNegativeFeedbackWithMetadata();
    const model = await loadModel();

    return new Response(
      JSON.stringify({
        available,
        positiveCount: positive.size,
        negativeCount: negative.size,
        trainedAt: model?.trainedAt ?? null,
        positiveCountWhenTrained: model?.positiveCount ?? null,
        negativeCountWhenTrained: model?.negativeCount ?? null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "Failed to get model status",
        message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
