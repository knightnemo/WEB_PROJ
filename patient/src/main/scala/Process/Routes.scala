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
      case "PatientLoginMessage" =>
        IO(decode[PatientLoginMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for PatientLoginMessage")))
          .flatMap { m =>
            m.fullPlan.map(_.asJson.toString)
          }
      case "PatientQueryMessage" =>
        IO(decode[PatientQueryMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for PatientQueryMessage")))
          .flatMap { m =>
            m.fullPlan.map(_.asJson.toString)
          }
      case "PatientRegisterMessage" =>
        IO(decode[PatientRegisterMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for PatientRegisterMessage")))
          .flatMap { m =>
            m.fullPlan.map(_.asJson.toString)
          }
      case "UserDeleteMessage" =>
        IO(decode[UserDeleteMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for UserDeleteMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "AllUsersQueryMessage" =>
        IO(decode[AllUsersQueryMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for AllUsersQueryMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "PatientChangePasswordMessage" =>
        IO(decode[PatientChangePasswordMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for PatientChangePasswordMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "ChangePatientBioMessage" =>
        IO(decode[ChangePatientBioMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for ChangePatientBioMessage")))
          .flatMap { m =>
            m.fullPlan.map(_.asJson.toString)
          }
      case "ChangePatientGenderMessage" => // 添加这一行
        IO(decode[ChangePatientGenderMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for ChangePatientGenderMessage"))) // 解码消息
          .flatMap { m =>
            m.fullPlan.map(_.asJson.toString) // 处理计划
          }
      case _ =>
        IO.raiseError(new Exception(s"Unknown type: $messageType"))
    }

  val service: HttpRoutes[IO] = HttpRoutes.of[IO]:
    case req @ POST -> Root / "api" / name =>
      println("request received")
      req.as[String].flatMap { executePlan(name, _) }.flatMap(Ok(_))
        .handleErrorWith { e =>
          println(e)
          BadRequest(e.getMessage)
        }
