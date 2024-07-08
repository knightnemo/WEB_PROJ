package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

case class AddCourseMessagePlanner(
                                    id: String,
                                    title: String,
                                    instructor: String,
                                    description: String,
                                    rating: String,
                                    image_url: String,
                                    resource_url: String,
                                    duration_minutes: Int,
                                    difficulty_level: String,
                                    category: String,
                                    subcategory: Option[String],
                                    language: String,
                                    prerequisites: List[String],
                                    learning_objectives: List[String],
                                    override val planContext: PlanContext
                                  ) extends Planner[String]:

  override def plan(using PlanContext): IO[String] = {
    writeDB(
      s"""INSERT INTO ${schemaName}.courses
         |(id, title, instructor, description, rating, image_url, resource_url,
         |duration_minutes, difficulty_level, category, subcategory,
         |language, prerequisites, learning_objectives)
         |VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""".stripMargin,
      List(
        SqlParameter("String", id),
        SqlParameter("String", title),
        SqlParameter("String", instructor),
        SqlParameter("String", description),
        SqlParameter("String", rating),
        SqlParameter("String", image_url),
        SqlParameter("String", resource_url),
        SqlParameter("Int", duration_minutes.toString),
        SqlParameter("String", difficulty_level),
        SqlParameter("String", category),
        SqlParameter("String", subcategory.getOrElse("")),
        SqlParameter("String", language),
        SqlParameter("String", prerequisites.mkString(",")),
        SqlParameter("String", learning_objectives.mkString(","))
      )
    ).attempt.flatMap {
      case Right(_) => IO.pure(s"Course added successfully with ID: $id")
      case Left(error) =>
        IO.raiseError(new Exception(s"Failed to add course: ${error.getMessage}"))
    }
  }