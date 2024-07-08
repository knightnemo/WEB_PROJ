package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

import java.time.LocalDateTime

case class UpdateCourseMessagePlanner(
                                       id: String,
                                       title: Option[String],
                                       instructor: Option[String],
                                       description: Option[String],
                                       rating: Option[String],
                                       image_url: Option[String],
                                       resource_url: Option[String],
                                       duration_minutes: Option[Int],
                                       difficulty_level: Option[String],
                                       category: Option[String],
                                       subcategory: Option[String],
                                       language: Option[String],
                                       prerequisites: Option[List[String]],
                                       learning_objectives: Option[List[String]],
                                       override val planContext: PlanContext
                                     ) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    val updates = List(
      title.map(t => (s"title = ?", SqlParameter("String", t))),
      instructor.map(i => (s"instructor = ?", SqlParameter("String", i))),
      description.map(d => (s"description = ?", SqlParameter("String", d))),
      rating.map(r => (s"rating = ?", SqlParameter("String", r))),
      image_url.map(url => (s"image_url = ?", SqlParameter("String", url))),
      resource_url.map(url => (s"resource_url = ?", SqlParameter("String", url))),
      duration_minutes.map(d => (s"duration_minutes = ?", SqlParameter("Int", d.toString))),
      difficulty_level.map(d => (s"difficulty_level = ?", SqlParameter("String", d))),
      category.map(c => (s"category = ?", SqlParameter("String", c))),
      subcategory.map(s => (s"subcategory = ?", SqlParameter("String", s))),
      language.map(l => (s"language = ?", SqlParameter("String", l))),
      prerequisites.map(p => (s"prerequisites = ?", SqlParameter("String", p.mkString(",")))),
      learning_objectives.map(lo => (s"learning_objectives = ?", SqlParameter("String", lo.mkString(","))))
    ).flatten

    if (updates.isEmpty) {
      IO.pure("No updates provided")
    } else {
      val (setClause, params) = updates.unzip
      val query = s"UPDATE ${schemaName}.courses SET ${setClause.mkString(", ")}, updated_at = ? WHERE id = ?"
      val allParams = params ++ List(SqlParameter("String", id))
      writeDB(query, allParams).map(_ => s"Course updated successfully for ID: $id")
    }
  }