package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, *}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import cats.effect.IO
import io.circe.generic.auto.*

case class UserDeleteMessagePlanner(userName: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    writeDB(
      s"DELETE FROM ${schemaName}.user_name WHERE user_name = ?",
      List(SqlParameter("String", userName))
    ).map(_ => s"User deletion operation completed for $userName")
  }