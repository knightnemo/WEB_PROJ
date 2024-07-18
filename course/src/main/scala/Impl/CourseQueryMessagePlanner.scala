package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import io.circe.Json

case class CourseQueryMessagePlanner(courseId: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"SELECT * FROM ${schemaName}.courses WHERE id = ?",
      List(SqlParameter("String", courseId))
    ).map { results =>
      if (results.isEmpty) "Course not found"
      else results.head.toString // Convert the Json object to a string
    }
  }