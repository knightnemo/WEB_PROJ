package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import io.circe.Json

case class CourseQueryMessagePlanner(searchTerm: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"""
      SELECT * FROM ${schemaName}.courses
      WHERE name LIKE ? OR description LIKE ?
      """,
      List(
        SqlParameter("String", s"%$searchTerm%"),
        SqlParameter("String", s"%$searchTerm%")
      )
    ).map { results =>
      if (results.isEmpty) "No courses found"
      else results.map(_.toString).mkString("\n") // Convert each Json object to a string and join them
    }
  }