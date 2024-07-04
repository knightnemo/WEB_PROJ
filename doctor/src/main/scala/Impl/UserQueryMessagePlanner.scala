package Impl

import cats.effect.IO
import io.circe.{Json, HCursor}
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.{readDBRows, *}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

case class UserQueryMessagePlanner(userName: String, override val planContext: PlanContext) extends Planner[Option[String]]:
  override def plan(using PlanContext): IO[Option[String]] = {
    readDBRows(
      s"SELECT user_name FROM ${schemaName}.user_name WHERE user_name = ?",
      List(SqlParameter("String", userName))
    ).map { jsonList =>
      jsonList.headOption.flatMap { json =>
        val cursor: HCursor = json.hcursor
        cursor.get[String]("user_name").toOption
      }
    }
  }