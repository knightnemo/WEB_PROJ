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
  private def executePlan(messageType:String, str: String): IO[String]=
    messageType match {
      case "AddPatientMessage" =>
        IO(decode[AddPatientMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for AddPatientMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "LoginMessage" =>
        IO(decode[LoginMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for LoginMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "RegisterMessage" =>
        IO(decode[RegisterMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for RegisterMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "DoctorQueryMessage" =>
        IO(decode[DoctorQueryMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for DoctorQueryMessage")))
          .flatMap(_.fullPlan.map(_.asJson.noSpaces))
      case "ChangePasswordMessage" =>
        IO(decode[ChangePasswordMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for ChangePasswordMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "ChangeGenderMessage" =>
        IO(decode[ChangeGenderPlanner](str).getOrElse(throw new Exception("Invalid JSON for ChangeGenderMessage")))
          .flatMap(_.fullPlan.map(_.asJson.toString))
      case "ChangeBioMessage" => // 添加这一行
        IO(decode[ChangeBioMessagePlanner](str).getOrElse(throw new Exception("Invalid JSON for ChangeBioMessage"))) // 解码消息
          .flatMap(_.fullPlan.map(_.asJson.toString)) // 处理计划
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
