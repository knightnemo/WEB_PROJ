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
      case "AddCommentMessage" =>
        IO(decode[AddCommentMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for AddCommentMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "DeleteCommentMessage" =>
        IO(decode[DeleteCommentMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for DeleteCommentMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "VoteCommentMessage" =>
        IO(decode[VoteCommentMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for VoteCommentMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "GetCourseCommentsMessage" =>
        IO(decode[GetCourseCommentsMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for GetCourseCommentsMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case _ =>
        IO.raiseError(new Exception(s"Unknown type: $messageType"))
    }

  val service: HttpRoutes[IO] = HttpRoutes.of[IO]:
    case req @ POST -> Root / "api" / name =>
      println("request received")
      req.as[String].flatMap{executePlan(name, _)}.flatMap(Ok(_))
        .handleErrorWith{e =>
          println(e)
          BadRequest(e.getMessage)
        }