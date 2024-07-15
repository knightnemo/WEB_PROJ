package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.ServiceUtils.schemaName
import io.circe.Json

case class GetAllNotificationsMessagePlanner(override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"SELECT * FROM ${schemaName}.notifications",
      List()
    ).map { results =>
      if (results.isEmpty) "[]"
      else results.toString // Convert the list of Json objects to a string
    }
  }