package Impl

import cats.effect.IO
import io.circe.generic.auto._
import io.circe.syntax._
import Common.API.{PlanContext, Planner}
import Common.DBAPI._
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.CourseAPI._

case class RecordCourseChangeMessagePlanner(courseId: String, changeType: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    writeDB(
      s"""
      INSERT INTO ${schemaName}.course_changes (course_id, change_type)
      VALUES (?, ?)
      """,
      List(SqlParameter("String", courseId), SqlParameter("String", changeType))
    ).map(_ => "Course change recorded successfully")
  }

case class GetUserCourseChangesMessagePlanner(userName: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    val query = s"""
      SELECT cc.course_id, c.title AS course_title, cc.change_type
      FROM ${schemaName}.course_changes cc
      JOIN ${schemaName}.courses c ON cc.course_id = c.id
      JOIN (
        SELECT course_name FROM ${schemaName}.user_course
        WHERE user_name = ?
        UNION
        SELECT course_name FROM ${schemaName}.course_favorites
        WHERE user_name = ?
      ) uc ON cc.course_id = uc.course_name
      ORDER BY cc.id DESC
    """

    val params = List(SqlParameter("String", userName), SqlParameter("String", userName))

    for {
      _ <- IO.println(s"Executing query: $query")
      _ <- IO.println(s"With parameters: $params")
      rows <- readDBRows(query, params)
      _ <- IO.println(s"Retrieved ${rows.length} rows")
      changes = rows.map { json =>
        CourseChange(
          courseId = decodeField[String](json, "course_id"),
          courseTitle = decodeField[String](json, "course_title"),
          changeType = decodeField[String](json, "change_type")
        )
      }
      _ <- IO.println(s"Processed ${changes.length} course changes")
    } yield changes.asJson.noSpaces
  }