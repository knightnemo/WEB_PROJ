package Impl

import cats.effect.IO
import io.circe.Json
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, *}
import Common.Object.{ParameterList, SqlParameter}
import Common.ServiceUtils.schemaName
import APIs.PatientAPI.PatientQueryMessage
import cats.effect.IO
import io.circe.generic.auto.*


case class LoginMessagePlanner(userName: String, password: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    // Attempt to validate the user by reading the rows from the database
    readDBRows(
      s"SELECT user_name FROM ${schemaName}.user_name WHERE user_name = ? AND password = ?",
      List(SqlParameter("String", userName), SqlParameter("String", password))
    ).map{
      case Nil => "Invalid user"
      case _ => "Valid user"
    }
  }
