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
import APIs.CourseAPI.CourseChangesMessages._

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

      case "UserCourseMessage" =>
        IO(decode[UserCourseMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for UserCourseMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "GetUserFavoriteCoursesMessage" =>
        IO(decode[GetUserFavoriteCoursesPlanner](str).getOrElse(throw new Exception("Invalid JSON for GetUserFavoriteCoursesMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "GetUserRatedCoursesMessage" =>
        IO(decode[GetUserRatedCoursesPlanner](str).getOrElse(throw new Exception("Invalid JSON for GetUserRatedCoursesMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "GetUserEnrolledCoursesMessage" =>
        IO(decode[GetUserEnrolledCoursesPlanner](str).getOrElse(throw new Exception("Invalid JSON for GetUserEnrolledCoursesMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "GetCourseEnrolledUsersMessage" =>
        IO(decode[GetCourseEnrolledUsersPlanner](str).getOrElse(throw new Exception("Invalid JSON for GetCourseEnrolledUsersMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "GetCourseRatingUsersMessage" =>
        IO(decode[GetCourseRatingUsersPlanner](str).getOrElse(throw new Exception("Invalid JSON for GetCourseRatingUsersMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "GetCourseFavoritedUsersMessage" =>
        IO(decode[GetCourseFavoritedUsersPlanner](str).getOrElse(throw new Exception("Invalid JSON for GetCourseFavoritedUsersMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))
        
      case "RecordCourseChangeMessage" =>
        IO(decode[RecordCourseChangeMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for RecordCourseChangeMessage")))
          .flatMap(m => m.fullPlan.map(_.asJson.toString))

      case "GetUserCourseChangesMessage" =>
        IO(decode[GetUserCourseChangesMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for GetUserCourseChangesMessage")))
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