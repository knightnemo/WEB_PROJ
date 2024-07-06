package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

import java.util.UUID

case class AddCourseMessagePlanner(title: String, instructor: String, description: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    val courseId = UUID.randomUUID().toString
    writeDB(
      s"INSERT INTO ${schemaName}.courses (id, title, instructor, description) VALUES (?, ?, ?, ?)",
      List(
        SqlParameter("String", courseId),
        SqlParameter("String", title),
        SqlParameter("String", instructor),
        SqlParameter("String", description)
      )
    ).map(_ => s"Course added successfully with ID: $courseId")
  }