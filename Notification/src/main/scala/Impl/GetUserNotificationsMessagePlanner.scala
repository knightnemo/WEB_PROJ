package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.ServiceUtils.schemaName
import Common.Object.SqlParameter
import io.circe.Json

case class GetUserNotificationsMessagePlanner(username: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"""
      SELECT * FROM ${schemaName}.notifications
      WHERE recipients LIKE ? OR recipients = 'all'
      """,
      List(SqlParameter("String", s"%$username%"))
    ).map { results =>
      if (results.isEmpty) "[]"
      else results.toString // Convert the list of Json objects to a string
    }
  }