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
      case "CreateClassroomMessage" =>
        IO(decode[CreateClassroomMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for CreateClassroomMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "DeleteClassroomMessage" =>
        IO(decode[DeleteClassroomMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for DeleteClassroomMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "UpdateClassroomMessage" =>
        IO(decode[UpdateClassroomMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for UpdateClassroomMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "GetClassroomMessage" =>
        IO(decode[GetClassroomMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for GetClassroomMessage")))
          .flatMap(_.fullPlan.map(_.asJson.noSpaces))
      case "CheckClassroomAvailabilityMessage" =>
        IO(decode[CheckClassroomAvailabilityMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for CheckClassroomAvailabilityMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case _ =>
        IO.raiseError(new Exception(s"Unknown type: $messageType"))
    }

  val service: HttpRoutes[IO] = HttpRoutes.of[IO] {
    case req @ POST -> Root / "api" / name =>
      println("request received")
      req.as[String].flatMap { executePlan(name, _) }.flatMap(Ok(_))
        .handleErrorWith { e =>
          println(e)
          BadRequest(e.getMessage)
        }
  }