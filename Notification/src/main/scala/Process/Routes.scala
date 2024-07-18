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
      case "CreateNotificationMessage" =>
        IO(decode[CreateNotificationMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for CreateNotificationMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "DeleteNotificationMessage" =>
        IO(decode[DeleteNotificationMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for DeleteNotificationMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "GetAllNotificationsMessage" =>
        IO(decode[GetAllNotificationsMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for GetAllNotificationsMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))
      case "GetUserNotificationsMessage" =>
        IO(decode[GetUserNotificationsMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for GetUserNotificationsMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))
      case _ =>
        IO.raiseError(new Exception(s"Unknown type: $messageType"))
    }

  val service: HttpRoutes[IO] = HttpRoutes.of[IO]:
    case req @ POST -> Root / "api" / name =>
      println(s"Request received for $name")
      req.as[String].flatMap { body =>
          println(s"Request body: $body")
          executePlan(name, body)
        }.flatMap(Ok(_))
        .handleErrorWith { e =>
          println(s"Error processing request: ${e.getMessage}")
          e.printStackTrace()
          BadRequest(e.getMessage)
        }