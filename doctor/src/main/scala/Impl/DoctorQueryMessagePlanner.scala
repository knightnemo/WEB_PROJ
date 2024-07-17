package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import io.circe.Json

case class DoctorQueryMessagePlanner(doctorName: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"""
         |SELECT user_name, bio, followers, following, review_count,
         |       slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8
         |FROM ${schemaName}.doctors
         |WHERE user_name = ?
      """.stripMargin,
      List(SqlParameter("String", doctorName))
    ).map { results =>
      if (results.isEmpty) "Doctor not found"
      else results.head.toString // Convert the Json object to a string
    }
  }