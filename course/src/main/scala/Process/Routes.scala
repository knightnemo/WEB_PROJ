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
      // Existing cases...

      case "AddCourseMessage" =>
        IO(decode[AddCourseMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for AddCourseMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "CourseQueryMessage" =>
        IO(decode[CourseQueryMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for CourseQueryMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "DeleteCourseMessage" =>
        IO(decode[DeleteCourseMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for DeleteCourseMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))
      case "UpdateCourseMessage" =>
        IO(decode[UpdateCourseMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for UpdateCourseMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))
      case "AllCoursesQueryMessage" =>
        IO(decode[AllCoursesQueryMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for AllCoursesQueryMessage")))
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