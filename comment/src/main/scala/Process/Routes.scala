package Process

import Common.API.{API, PlanContext, TraceID}
import Impl.*
import cats.effect.*
import io.circe.generic.auto.*
import io.circe.parser.decode
import io.circe.syntax.*
import org.http4s.*
import org.http4s.dsl.io.*
import APIs.CommentAPI.*

import java.util.UUID

object Routes:
  private implicit val defaultPlanContext: PlanContext = PlanContext(
    traceID = TraceID(UUID.randomUUID().toString),
    transactionLevel = 0
  )

  private def executePlan(messageType: String, str: String): IO[String] =
    messageType match {
      case "AddCommentMessage" =>
        IO(decode[AddCommentMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for AddCommentMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "DeleteCommentMessage" =>
        IO(decode[DeleteCommentMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for DeleteCommentMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "LikeCommentMessage" =>
        IO(decode[LikeCommentMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for LikeCommentMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "DislikeCommentMessage" =>
        IO(decode[DislikeCommentMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for DislikeCommentMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))
      case "GetCommentsMessage" =>
        IO(decode[GetCommentsMessage](str).getOrElse(throw new Exception("Invalid JSON for GetCommentsMessage")))
          .flatMap(msg => GetCommentsMessagePlanner(msg, defaultPlanContext).fullPlan.map(_.asJson.toString))
      case _ =>
        IO.raiseError(new Exception(s"Unknown message type: $messageType"))
    }

  val service: HttpRoutes[IO] = HttpRoutes.of[IO] {
    case req @ POST -> Root / "api" / name =>
      println(s"Request received: $name")
      req.as[String].flatMap(executePlan(name, _)).flatMap(Ok(_))
        .handleErrorWith { e =>
          println(s"Error processing request: ${e.getMessage}")
          BadRequest(e.getMessage)
        }
  }