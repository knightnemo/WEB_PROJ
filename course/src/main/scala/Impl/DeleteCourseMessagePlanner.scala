package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

case class DeleteCourseMessagePlanner(courseId: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    writeDB(
      s"DELETE FROM ${schemaName}.courses WHERE id = ?",
      List(SqlParameter("String", courseId))
    ).map(_ => s"Course deletion operation completed for ID: $courseId")
  }