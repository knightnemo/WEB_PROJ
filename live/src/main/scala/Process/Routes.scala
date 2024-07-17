package Process

import Common.API.PlanContext
import Impl.*
import cats.effect.*
import io.circe.generic.auto.*
import io.circe.parser.decode
import io.circe.syntax.*
import org.http4s.*
import org.http4s.client.Client
import org.http4s.dsl.io.*

object Routes:
  private def executePlan(messageType: String, str: String): IO[String] =
    messageType match {
      case "CreateLiveStreamMessage" =>
        IO(decode[CreateLiveStreamMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for CreateLiveStreamMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "DeleteLiveStreamMessage" =>
        IO(decode[DeleteLiveStreamMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for DeleteLiveStreamMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "UpdateLiveStreamMessage" =>
        IO(decode[UpdateLiveStreamMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for UpdateLiveStreamMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "GetLiveStreamMessage" =>
        IO(decode[GetLiveStreamMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for GetLiveStreamMessage")))
          .flatMap(_.fullPlan.map(_.asJson.noSpaces))
      case "CheckLiveStreamAvailabilityMessage" =>
        IO(decode[CheckLiveStreamAvailabilityMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for CheckLiveStreamAvailabilityMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case _ =>
        IO.raiseError(new Exception(s"Unknown type: $messageType"))
    }

  val service: HttpRoutes[IO] = HttpRoutes.of[IO] {
    case req @ POST -> Root / "api" / name =>
      println(s"Request received: $name")
      req.as[String].flatMap { executePlan(name, _) }.flatMap(Ok(_))
        .handleErrorWith { e =>
          println(s"Error processing request: ${e.getMessage}")
          BadRequest(e.getMessage)
        }
  }